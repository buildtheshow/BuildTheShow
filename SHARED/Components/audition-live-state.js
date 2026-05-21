(function () {
  const VALID_EVENTS = new Set([
    'performer_checked_in',
    'performer_marked_no_show',
    'performer_unchecked',
    'room_requested_next',
    'performer_sent_to_room',
    'room_started_audition',
    'room_finished_audition',
  ]);

  function nowIso() {
    return new Date().toISOString();
  }

  function makeTraceId() {
    try { return crypto.randomUUID(); } catch { return `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  }

  function checkinStateKey(sessionId, applicationId) {
    return `checkin:${sessionId || 'general'}:${applicationId || 'unknown'}`;
  }

  function roomStateKey(roomKey) {
    return `room:${roomKey || 'main'}`;
  }

  function roomRequestStateKey(roomKey) {
    return `room-request:${roomKey || 'main'}`;
  }

  function normalizeEvent(event = {}) {
    const eventType = event.event_type || event.type || '';
    if (!VALID_EVENTS.has(eventType)) throw new Error(`Invalid audition live event: ${eventType}`);
    return {
      event_type: eventType,
      session_id: event.session_id || null,
      application_id: event.application_id || event.performer_id || null,
      room_key: event.room_key || null,
      payload: event.payload || {},
      state_key: event.state_key || '',
      state_type: event.state_type || '',
      status: event.status || null,
    };
  }

  function createAuditionLiveState(options = {}) {
    const sb = options.supabase;
    const productionId = options.productionId;
    const teamAccess = options.teamAccess || {};
    const onState = typeof options.onState === 'function' ? options.onState : () => {};
    const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {};
    const onError = typeof options.onError === 'function' ? options.onError : () => {};
    const onTiming = typeof options.onTiming === 'function' ? options.onTiming : (stage, detail) => {
      try { console.info('[BTS live timing]', { stage, ...detail }); } catch {}
    };
    const states = new Map();
    let channel = null;
    let channelSubscribed = false;
    const pendingBroadcasts = [];
    let broadcastFlushTimer = null;

    function timing(stage, detail = {}) {
      onTiming(stage, {
        at: nowIso(),
        production_id: productionId,
        ...detail,
      });
    }

    function mergeState(row) {
      if (!row?.state_key) return null;
      states.set(row.state_key, row);
      onState(row);
      return row;
    }

    async function load() {
      if (!sb || !productionId) return [];
      let data, error;
      if (teamAccess.enabled && teamAccess.sessionToken) {
        ({ data, error } = await sb.rpc('team_audition_live_state_list_for_session', {
          p_production_id: productionId,
          p_session_token: teamAccess.sessionToken,
        }));
      } else {
        ({ data, error } = await sb
          .from('production_audition_live_state')
          .select('*')
          .eq('production_id', productionId));
      }
      if (error) {
        onError(error);
        throw error;
      }
      states.clear();
      (data || []).forEach(mergeState);
      return data || [];
    }

    async function publish(rawEvent) {
      if (!sb || !productionId) return null;
      const event = normalizeEvent(rawEvent);
      const traceId = event.payload?.trace_id || makeTraceId();
      const payload = {
        ...event.payload,
        trace_id: traceId,
        client_created_at: event.payload?.client_created_at || nowIso(),
      };
      const optimisticState = {
        production_id: productionId,
        session_id: event.session_id,
        application_id: event.application_id,
        room_key: event.room_key,
        state_key: event.state_key,
        state_type: event.state_type,
        event_type: event.event_type,
        status: event.status,
        payload,
        updated_at: nowIso(),
        _pending: true,
        _trace_id: traceId,
      };
      mergeState(optimisticState);
      timing('ui_optimistic_state_created', { trace_id: traceId, event_type: event.event_type, state_type: event.state_type, state_key: event.state_key });
      broadcastStatePreview(optimisticState);

      try {
        let stateRows, error;
        timing('supabase_save_started', { trace_id: traceId, event_type: event.event_type, state_type: event.state_type, state_key: event.state_key });
        if (teamAccess.enabled && teamAccess.sessionToken) {
          ({ data: stateRows, error } = await sb.rpc('team_audition_live_event_apply_for_session', {
            p_production_id: productionId,
            p_session_token: teamAccess.sessionToken,
            p_session_id: event.session_id,
            p_application_id: event.application_id,
            p_room_key: event.room_key,
            p_event_type: event.event_type,
            p_payload: payload,
            p_state_key: event.state_key,
            p_state_type: event.state_type,
            p_status: event.status,
          }));
        } else {
          const { data: eventRow, error: eventError } = await sb
            .from('production_audition_live_events')
            .insert({
              production_id: productionId,
              session_id: event.session_id,
              application_id: event.application_id,
              room_key: event.room_key,
              event_type: event.event_type,
              payload,
            })
            .select('*')
            .single();
          if (eventError) throw eventError;
          onEvent(eventRow);

          ({ data: stateRows, error } = await sb
            .from('production_audition_live_state')
            .upsert({
              production_id: productionId,
              session_id: event.session_id,
              application_id: event.application_id,
              room_key: event.room_key,
              state_key: event.state_key,
              state_type: event.state_type,
              event_type: event.event_type,
              status: event.status,
              payload,
            }, { onConflict: 'production_id,state_key' })
            .select('*'));
        }
        if (error) throw error;
        const saved = Array.isArray(stateRows) ? stateRows[0] : stateRows;
        if (saved) mergeState(saved);
        timing('supabase_save_finished', { trace_id: traceId, event_type: event.event_type, state_type: event.state_type, state_key: event.state_key });
        return saved || optimisticState;
      } catch (error) {
        onError(error, optimisticState);
        const failed = { ...optimisticState, _pending: false, _error: true, error_message: error?.message || String(error || 'Save failed') };
        mergeState(failed);
        throw error;
      }
    }

    function subscribe() {
      if (!sb || !productionId || channel) return channel;
      channel = sb.channel(`production-audition-live-state:${productionId}`, {
        config: { broadcast: { self: false } }
      })
        .on('broadcast', { event: 'state_preview' }, payload => {
          const state = payload?.payload?.state || payload?.state || payload;
          if (state?.production_id && String(state.production_id) !== String(productionId)) return;
          if (state?.state_key) {
            timing('broadcast_received', { trace_id: state.payload?.trace_id || state._trace_id || '', state_type: state.state_type, state_key: state.state_key });
            mergeState({ ...state, _broadcast: true });
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'production_audition_live_state',
          filter: `production_id=eq.${productionId}`,
        }, payload => {
          if (payload?.new?.state_key) mergeState(payload.new);
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'production_audition_live_events',
          filter: `production_id=eq.${productionId}`,
        }, payload => {
          if (payload?.new) onEvent(payload.new);
        })
        .subscribe(status => {
          channelSubscribed = status === 'SUBSCRIBED';
          timing('broadcast_channel_status', { status });
          if (channelSubscribed) flushBroadcastQueue();
        });
      return channel;
    }

    function broadcastStatePreview(state) {
      if (!sb || !productionId || !state?.state_key) return;
      if (!channel) subscribe();
      pendingBroadcasts.push({
        state,
        attempts: 0,
        queued_at: nowIso(),
      });
      timing('broadcast_queued', { trace_id: state.payload?.trace_id || state._trace_id || '', state_type: state.state_type, state_key: state.state_key });
      flushBroadcastQueue();
    }

    function flushBroadcastQueue() {
      clearTimeout(broadcastFlushTimer);
      if (!pendingBroadcasts.length) return;
      if (!channelSubscribed || !channel?.send) {
        broadcastFlushTimer = setTimeout(flushBroadcastQueue, 150);
        return;
      }
      const remaining = [];
      pendingBroadcasts.splice(0).forEach(item => {
        try {
          channel.send({
            type: 'broadcast',
            event: 'state_preview',
            payload: {
              production_id: productionId,
              state: item.state,
              sent_at: nowIso(),
            },
          });
          timing('broadcast_sent', {
            trace_id: item.state?.payload?.trace_id || item.state?._trace_id || '',
            state_type: item.state?.state_type,
            state_key: item.state?.state_key,
            attempts: item.attempts,
          });
        } catch (error) {
          item.attempts += 1;
          remaining.push(item);
          timing('broadcast_send_failed', {
            trace_id: item.state?.payload?.trace_id || item.state?._trace_id || '',
            state_type: item.state?.state_type,
            state_key: item.state?.state_key,
            attempts: item.attempts,
            error: error?.message || String(error || ''),
          });
        }
      });
      pendingBroadcasts.push(...remaining);
      if (pendingBroadcasts.length) broadcastFlushTimer = setTimeout(flushBroadcastQueue, 150);
    }

    function destroy() {
      if (channel) {
        try { sb.removeChannel(channel); } catch {}
        channel = null;
        channelSubscribed = false;
        clearTimeout(broadcastFlushTimer);
      }
    }

    return {
      states,
      checkinStateKey,
      roomStateKey,
      roomRequestStateKey,
      load,
      publish,
      subscribe,
      destroy,
      getState: key => states.get(key) || null,
    };
  }

  window.BTSAuditionLiveState = {
    create: createAuditionLiveState,
    checkinStateKey,
    roomStateKey,
    roomRequestStateKey,
  };
})();
