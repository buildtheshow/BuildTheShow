(function () {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtml(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const AUDITION_SHAPES = [
    { value: 'main_only', label: 'Just one main audition', desc: 'Nice and simple. One main round to start with.' },
    { value: 'main_dance', label: 'Main audition + dance call', desc: 'Run a main round, plus a separate dance or movement round.' },
    { value: 'main_callbacks', label: 'Main audition + callbacks', desc: 'See everyone once, then bring some people back later.' },
    { value: 'full_rounds', label: 'Main audition + dance call + callbacks', desc: 'Build the full system now, even if you tweak it later.' },
    { value: 'video_only', label: 'Video submissions', desc: 'Let performers submit self-tapes instead of coming in person.' },
    { value: 'unsure', label: 'I’m not sure yet', desc: 'We’ll build the most common version and you can adjust from there.' },
  ];

  const MAIN_FORMAT_OPTIONS = [
    { value: 'individual_booked', label: 'They choose a time', desc: 'You set the time slots. Performers see what’s available and book one. Great for structured schedules and clear arrival times.' },
    { value: 'individual_assigned', label: 'You assign auditions', desc: 'You assign individual auditions yourself into the schedule. Great for invitation-only auditions or when you want full control.' },
    { value: 'arrival_window', label: 'They arrive at a set time', desc: 'They arrive within a short set time. You call them in when you’re ready. Great for younger performers or when timing may shift.' },
    { value: 'open_call', label: 'They just drop in', desc: 'No booking. They arrive anytime during the audition day and wait. Great for open-call days and flexible flow.' },
    { value: 'video_submission', label: 'Self Tape', desc: 'Performers submit a self tape instead of attending in person.' },
    { value: 'video_live', label: 'Video Call', desc: 'You run auditions live by video call instead of in person.' },
  ];

  const MAIN_SEEN_OPTIONS = [
    { value: 'individual', label: 'Individual', desc: 'One performer at a time.' },
    { value: 'small_groups', label: 'Small groups', desc: 'Performers are seen together in short combinations or scenes.' },
    { value: 'full_group', label: 'Full Group', desc: 'Everyone booked to audition is seen together at once (workshop style / first day of rehearsal).' },
    { value: 'mixed', label: 'Mixed', desc: 'A combination of individual, pairs, and group work.' },
  ];

  const MAIN_TIMING_OPTIONS = [
    { value: 'booked', label: 'They choose a time', desc: 'You set times or blocks and performers book one. A time can be for one performer or a small group. Example: 4:00, 4:10, 4:20, or 5 people all booked into the 4:00 group.' },
    { value: 'assigned', label: 'You assign auditions', desc: 'You place performers into specific times yourself. A time can be for one performer or a group. Example: You build the full schedule ahead of time.' },
    { value: 'window', label: 'Group arrival', desc: 'You set one arrival time for a group of performers, and call them in one by one. Example: 5 performers all arrive at 4:00, then wait to be called.' },
    { value: 'drop_in', label: 'They drop in', desc: 'No booking. Performers arrive and wait their turn. Example: Open call from 3:00–7:00.' },
  ];

  const DANCE_FORMAT_OPTIONS = [
    { value: 'dance_group_full', label: 'Full group call', desc: 'Everyone attends at the same time and learns the combination together.' },
    { value: 'dance_group_split', label: 'Large group, then split', desc: 'Start together, then divide into smaller groups to be seen more clearly.' },
    { value: 'dance_block', label: 'Small group rotation', desc: 'Bring performers in in smaller groups throughout the session.' },
    { value: 'dance_group_individual', label: 'Individual or small group assessment', desc: 'Performers are seen one at a time or in very small groups.' },
    { value: 'dance_assigned_groups', label: 'Assigned groups', desc: 'You place performers into specific groups and times.' },
    { value: 'dance_drop_in', label: 'Open call', desc: 'No booking. Performers arrive during the set time and join in.' },
    { value: 'dance_video', label: 'Dance Self Tape', desc: 'Performers submit a dance self tape instead of attending in person.' },
    { value: 'dance_video_live', label: 'Video Call', desc: 'You run the dance call live by video call instead of in person.' },
    { value: 'dance_other', label: 'Other', desc: 'Something different. You define how it works.' },
  ];

  const DANCE_SEEN_OPTIONS = [
    { value: 'individual', label: 'Individual', desc: 'Performers are seen one at a time.' },
    { value: 'small_group', label: 'Small group', desc: 'Performers are brought in and seen in smaller groups. You choose the size.' },
    { value: 'full_group', label: 'Full group', desc: 'Everyone who auditions attends at the same time and is seen together.' },
  ];

  const DANCE_TIMING_OPTIONS = [
    { value: 'booked', label: 'They choose a time', desc: 'You set times or group blocks and performers book one. Example: 4:00 to 4:30, 4:30 to 5:00, with several performers in each block.' },
    { value: 'assigned', label: 'You assign times', desc: 'You place performers into specific times yourself. Those times can hold individuals or groups. Example: You build your groups ahead of time.' },
    { value: 'window', label: 'Group arrival', desc: 'You set one arrival time for a group, and bring performers in as you are ready. Example: 5 performers all arrive at 4:00, then join in when called.' },
    { value: 'drop_in', label: 'They just drop in', desc: 'No booking. Performers arrive during the set time and join in. Example: Dance call runs 4:00 to 6:00.' },
  ];

  const OTHER_SEEN_OPTIONS = [
    { value: 'individual', label: 'Individual', desc: 'One performer at a time.' },
    { value: 'small_groups', label: 'Small groups', desc: 'Performers are seen together.' },
    { value: 'full_group', label: 'Full group', desc: 'Everyone is seen together at once.' },
    { value: 'mixed', label: 'Mixed', desc: 'A combination of formats.' },
  ];

  const CALLBACK_FORMAT_OPTIONS = [
    { value: 'callback_assigned', label: 'We assign callback times' },
    { value: 'callback_booking', label: 'Let invited performers book' },
    { value: 'callback_scene_groups', label: 'Small scene groups' },
    { value: 'callback_ensemble', label: 'Bigger ensemble groups' },
    { value: 'callback_workshop', label: 'Workshop-style callback' },
    { value: 'callback_dance', label: 'Dance callback' },
    { value: 'callback_music', label: 'Music callback' },
    { value: 'callback_mixed', label: 'Mixed callback' },
    { value: 'callback_video', label: 'Callback self-tape' },
    { value: 'callback_video_live', label: 'Video call callback' },
  ];

  const CALLBACK_TIMING_OPTIONS = [
    { value: 'booking', label: 'They choose a time', desc: 'You set callback times or blocks and invited performers book one. A callback time can be for one performer, a pair, or a small group. Example: 5:00, 5:10, 5:20, or one 6:00 block for a grouped callback. If needed, one of those callback slots can happen live over video.' },
    { value: 'assigned', label: 'You assign callbacks', desc: 'You invite performers and assign their callback times yourself. A callback time can be for one performer or a group. Example: You build the callback schedule ahead of time.' },
    { value: 'window', label: 'Group arrival', desc: 'You set one callback arrival time for the invited performers, then call them in from there. Example: 8 performers all arrive at 5:00, then wait to be called.' },
  ];

  const OTHER_TIMING_OPTIONS = [
    { value: 'booked', label: 'They choose a time', desc: 'You set times or blocks and performers book one. A time can be for one performer or a small group. Example: 4:00, 4:10, 4:20, or 5 people all booked into the 4:00 group.' },
    { value: 'assigned', label: 'You assign auditions', desc: 'You place performers into specific times yourself. A time can be for one performer or a group. Example: You build the full schedule ahead of time.' },
    { value: 'window', label: 'Group arrival', desc: 'You set one arrival time for a group of performers, and call them in one by one. Example: 5 performers all arrive at 4:00, then wait to be called.' },
    { value: 'drop_in', label: 'They just drop in', desc: 'No booking. Performers arrive and wait. Example: Open call from 3:00–7:00.' },
  ];

  const CALLBACK_SEEN_OPTIONS = [
    { value: 'individual', label: 'Individual', desc: 'One performer at a time.' },
    { value: 'small_groups', label: 'Small groups', desc: 'Performers are seen together in short scenes or combinations.' },
    { value: 'full_group', label: 'Full group', desc: 'Everyone who is called back comes together at the same time.' },
    { value: 'mixed', label: 'Mixed', desc: 'A combination of individual, pairs, and group work.' },
  ];

  const CALLBACK_CONTENT_OPTIONS = [
    { value: 'scene_work', label: 'Scene and character work', desc: 'You read scenes from the show, test pairings, and explore specific roles.' },
    { value: 'music', label: 'Music callback', desc: 'You hear more material from the show and test vocal fit.' },
    { value: 'dance', label: 'Dance callback', desc: 'You assess movement for invited performers.' },
    { value: 'mixed', label: 'Mixed callback', desc: 'You combine scenes, music, and movement in one round.' },
  ];

  const ACTIVITY_OPTIONS = [
    { value: 'sing', label: 'Sing' },
    { value: 'read', label: 'Read scenes or a monologue' },
    { value: 'dance', label: 'Dance' },
    { value: 'move_group', label: 'Move as a group' },
    { value: 'self_tape', label: 'Send a self-tape' },
    { value: 'mix', label: 'A little of everything' },
  ];

  const ROUND_ACTIVITY_OPTIONS = {
    main: ACTIVITY_OPTIONS.filter(option => ['sing', 'read', 'dance', 'move_group', 'mix'].includes(option.value)),
    dance: ACTIVITY_OPTIONS.filter(option => ['dance', 'move_group', 'mix'].includes(option.value)),
    callback: ACTIVITY_OPTIONS.filter(option => ['read', 'sing', 'dance', 'mix'].includes(option.value)),
    other: ACTIVITY_OPTIONS.filter(option => ['sing', 'read', 'dance', 'move_group', 'mix'].includes(option.value)),
  };

  const PREP_OPTIONS = [
    { value: 'short_song', label: 'A short song' },
    { value: 'monologue', label: 'A monologue' },
    { value: 'optional_monologue', label: 'Optional monologue' },
    { value: 'movement_clothes', label: 'Comfortable clothes for movement' },
    { value: 'teach_here', label: 'We’ll teach material there' },
    { value: 'nothing_special', label: 'Nothing special' },
  ];

  const COLLECT_OPTIONS = [
    { key: 'headshot', label: 'Headshot', desc: 'A photo for your casting team.' },
    { key: 'conflicts', label: 'Conflicts', desc: 'Availability and schedule conflicts.' },
    { key: 'experience', label: 'Experience', desc: 'Background, training, or notes.' },
    { key: 'casting_preference', label: 'Casting preference', desc: 'Roles or areas they are interested in.' },
    { key: 'extra_notes', label: 'Extra notes', desc: 'A place for anything else they want to share.' },
  ];

  const CHARACTER_SETUP_OPTIONS = [
    { value: 'ai_import', label: 'Import with AI', desc: 'Paste your character list and the AI will build the cards. One card per character and group, exactly as they appear in the script.' },
    { value: 'manual_now', label: 'Set up manually', desc: 'Build the character cards yourself. We will give you a simple starter structure to work from.' },
    { value: 'sort_out_later', label: 'Sort it out later', desc: 'Skip for now and set up characters from the workspace when you are ready.' },
  ];

  const DEFAULT_STATE = {
    shape: null,
    accessModes: [],
    mainFormat: null,
    mainSeeing: null,
    mainTiming: null,
    danceFormat: null,
    danceSetup: {
      seeing: null,
      timing: null,
    },
    callbackFormat: null,
    callbackSetup: {
      timing: null,
      seeing: null,
      content: [],
    },
    otherSeeing: null,
    otherTiming: null,
    activities: [],
    roundActivities: {
      main: [],
      dance: [],
      callback: [],
      other: [],
    },
    prep: [],
    prepDetails: {
      short_song: '',
      monologue: '',
      optional_monologue: '',
      movement_clothes: '',
      teach_here: '',
    },
    prepCustom: '',
    collect: {
      headshot: false,
      conflicts: false,
      experience: false,
      casting_preference: false,
      extra_notes: false,
    },
    ageRange: '',
    location: '',
    characterSetup: null,
    characterWhen: null,
    rounds: {
      main: { date: '', start: '', end: '', slotLength: 7, buffer: 3, capacity: 1 },
      dance: { date: '', start: '', end: '', slotLength: 60, buffer: 0, capacity: 18 },
      callback: { date: '', start: '', end: '', slotLength: 10, buffer: 5, capacity: 1 },
    },
  };

  function createDefaultState() {
    return clone(DEFAULT_STATE);
  }

  function activityOptionsForRound(roundKey) {
    return clone(ROUND_ACTIVITY_OPTIONS[roundKey] || ROUND_ACTIVITY_OPTIONS.main);
  }

  function collectActivityValues(state) {
    const roundActivities = state?.roundActivities || {};
    const combined = new Set();
    Object.values(roundActivities).forEach(list => {
      (Array.isArray(list) ? list : []).filter(Boolean).forEach(value => combined.add(value));
    });
    if (combined.size) return [...combined];
    return (state?.activities || []).filter(Boolean);
  }

  function timingOption(value, label, desc) {
    return { value, label, desc };
  }

  function normalizeSeeingValue(value) {
    if (value === 'pairs_small') return 'small_groups';
    return value;
  }

  function timingAudienceMode(seeing) {
    seeing = normalizeSeeingValue(seeing);
    if (seeing === 'individual') return 'individual';
    if (seeing === 'mixed') return 'both';
    if (seeing === 'small_groups' || seeing === 'small_group' || seeing === 'full_group') return 'group';
    return 'individual';
  }

  function defaultRoundValues(roundType) {
    if (roundType === 'dance_call') return clone(DEFAULT_STATE.rounds.dance);
    if (roundType === 'callback') return clone(DEFAULT_STATE.rounds.callback);
    return clone(DEFAULT_STATE.rounds.main);
  }

  function suggestedRoundSettings(roundType, flow, seeing) {
    const mode = timingAudienceMode(seeing);
    if (roundType === 'dance_call') {
      if (mode === 'individual') return { slotLength: 10, buffer: 5, capacity: 1 };
      return { slotLength: 60, buffer: 0, capacity: seeing === 'full_group' ? 20 : 8 };
    }
    if (roundType === 'callback') {
      if (mode === 'group') return { slotLength: seeing === 'full_group' ? 30 : 20, buffer: 5, capacity: seeing === 'full_group' ? 12 : 4 };
      if (mode === 'both') return { slotLength: 20, buffer: 5, capacity: 6 };
      return { slotLength: 10, buffer: 5, capacity: 1 };
    }
    if (mode === 'group') return { slotLength: seeing === 'full_group' ? 45 : 20, buffer: 5, capacity: seeing === 'full_group' ? 20 : 4 };
    if (mode === 'both') return { slotLength: 20, buffer: 5, capacity: 6 };
    return { slotLength: 7, buffer: 3, capacity: 1 };
  }

  function resolveRoundScheduleValues(roundType, flow, seeing, values) {
    const base = defaultRoundValues(roundType);
    const source = { ...base, ...(values || {}) };
    const suggested = suggestedRoundSettings(roundType, flow, seeing);
    return {
      ...source,
      slotLength: Number(source.slotLength) === Number(base.slotLength) ? suggested.slotLength : Number(source.slotLength || base.slotLength),
      buffer: Number(source.buffer) === Number(base.buffer) ? suggested.buffer : Number(source.buffer || base.buffer),
      capacity: Number(source.capacity) === Number(base.capacity) ? suggested.capacity : Number(source.capacity || base.capacity),
    };
  }

  function getMainTimingOptions(seeing) {
    const mode = timingAudienceMode(seeing);
    if (mode === 'group') {
      return [
        timingOption('booked', 'They choose a time', 'You set group times or blocks and groups book one. Example: a 4:00 group, a 4:30 group, or a 5:00 workshop block.'),
        timingOption('assigned', 'You assign auditions', 'You place groups into specific times yourself. Example: You build the group schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one arrival time for a group, then call them in from there. Example: everyone arrives at 4:00, then you bring groups in as ready.'),
        timingOption('drop_in', 'They drop in', 'No booking. Groups arrive and wait to be seen. Example: Open call from 3:00–7:00, with groups formed through the day.'),
      ];
    }
    if (mode === 'both') {
      return [
        timingOption('booked', 'They choose a time', 'You set times or blocks and people book one. A time can be for one performer or a group. Example: 4:00 solo, 4:20 pair, 5:00 group.'),
        timingOption('assigned', 'You assign auditions', 'You place people into specific times yourself. A time can be for one performer or a group. Example: You build the full schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one arrival time, then run the round from there. Example: everyone arrives at 4:00, then you move between solo and group work as needed.'),
        timingOption('drop_in', 'They drop in', 'No booking. People arrive and are folded into the flow as needed. Example: open call through the day with solo and group work happening inside it.'),
      ];
    }
    return [
      timingOption('booked', 'They choose a time', 'You set time slots and performers book one. Example: 4:00, 4:10, 4:20.'),
      timingOption('assigned', 'You assign auditions', 'You place performers into specific times yourself. Example: You build the full schedule ahead of time.'),
      timingOption('window', 'Group arrival', 'You set one arrival time for a small group of performers, then call them in one by one. Example: 5 performers all arrive at 4:00, then wait to be called.'),
      timingOption('drop_in', 'They drop in', 'No booking. Performers arrive and wait their turn. Example: Open call from 3:00–7:00.'),
    ];
  }

  function getDanceTimingOptions(seeing) {
    const mode = timingAudienceMode(seeing);
    if (mode === 'individual') {
      return [
        timingOption('booked', 'They choose a time', 'You set times, and performers book one. Example: 4:00, 4:10, 4:20.'),
        timingOption('assigned', 'You assign times', 'You place performers into specific times yourself. Example: You build the dance schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one arrival time for a small set of performers, then see them one by one. Example: 5 performers all arrive at 4:00, then wait to be called.'),
        timingOption('drop_in', 'They just drop in', 'No booking. Performers arrive during the set time and wait their turn. Example: dance call runs 4:00 to 6:00, and you see people one at a time as they arrive.'),
      ];
    }
    return [
      timingOption('booked', 'They choose a time', 'You set times or group blocks and groups book one. Example: 4:00 to 4:30, 4:30 to 5:00, with several performers in each block.'),
      timingOption('assigned', 'You assign times', 'You place groups into specific times yourself. Example: You build your groups ahead of time.'),
      timingOption('window', 'Group arrival', 'You set one arrival time for a group, then bring performers in as you are ready. Example: 5 performers all arrive at 4:00, then join in when called.'),
      timingOption('drop_in', 'They just drop in', 'No booking. Groups arrive during the set time and join in. Example: dance call runs 4:00 to 6:00, and people join the next group as they arrive.'),
    ];
  }

  function getCallbackTimingOptions(seeing) {
    const mode = timingAudienceMode(seeing);
    if (mode === 'group') {
      return [
        timingOption('booking', 'They choose a time', 'You set callback times or blocks and invited groups book one. Example: a 5:00 scene group, a 5:30 pairing, or a 6:00 full-group callback.'),
        timingOption('assigned', 'You assign callbacks', 'You invite people and place groups into callback times yourself. Example: You build the grouped callback schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one callback arrival time for a group, then call people in from there. Example: everyone arrives at 5:00, then you bring them in by pairing or scene group.'),
      ];
    }
    if (mode === 'both') {
      return [
        timingOption('booking', 'They choose a time', 'You set callback times or blocks and invited people book one. A time can be for one performer or a group. Example: 5:00 solo, 5:20 pair, 6:00 group.'),
        timingOption('assigned', 'You assign callbacks', 'You invite performers and place them into specific callback times yourself. A time can be for one performer or a group. Example: You build the callback schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one callback arrival time, then run the round from there. Example: everyone arrives at 5:00, then you move between solo, pair, and group work.'),
      ];
    }
    return [
      timingOption('booking', 'They choose a time', 'You set callback time slots and invited performers book one. Example: 5:00, 5:10, 5:20. If needed, one of those callback slots can happen live over video.'),
      timingOption('assigned', 'You assign callbacks', 'You invite performers and assign their callback times yourself. Example: You build the callback schedule ahead of time.'),
      timingOption('window', 'Group arrival', 'You set one callback arrival time for the invited performers, then call them in from there. Example: 8 performers all arrive at 5:00, then wait to be called.'),
    ];
  }

  function getOtherTimingOptions(seeing) {
    const mode = timingAudienceMode(seeing);
    if (mode === 'group') {
      return [
        timingOption('booked', 'They choose a time', 'You set times or blocks and groups book one. Example: a 4:00 pair, a 4:30 small-group block, or a 5:00 workshop group.'),
        timingOption('assigned', 'You assign auditions', 'You place groups into specific times yourself. Example: You build the grouped schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one arrival time for a group, then call them in from there. Example: everyone arrives at 4:00, then you bring groups in as needed.'),
        timingOption('drop_in', 'They just drop in', 'No booking. Groups arrive and wait to be seen. Example: people arrive during the window and you form groups on the fly.'),
      ];
    }
    if (mode === 'both') {
      return [
        timingOption('booked', 'They choose a time', 'You set times or blocks and people book one. A time can be for one performer or a group. Example: 4:00 solo, 4:20 pair, 5:00 group.'),
        timingOption('assigned', 'You assign auditions', 'You place people into specific times yourself. A time can be for one performer or a group. Example: You build the full schedule ahead of time.'),
        timingOption('window', 'Group arrival', 'You set one arrival time, then run the round from there. Example: everyone arrives at 4:00, then you mix solo and group work as needed.'),
        timingOption('drop_in', 'They just drop in', 'No booking. Performers arrive and are folded into the flow as needed. Example: open call through the day with different formats happening inside it.'),
      ];
    }
    return [
      timingOption('booked', 'They choose a time', 'You set time slots and performers book one. Example: 4:00, 4:10, 4:20.'),
      timingOption('assigned', 'You assign auditions', 'You place performers into specific times yourself. Example: You build the full schedule ahead of time.'),
      timingOption('window', 'Group arrival', 'You set one arrival time for a small group of performers, then call them in one by one. Example: 5 performers all arrive at 4:00, then wait to be called.'),
      timingOption('drop_in', 'They just drop in', 'No booking. Performers arrive and wait. Example: Open call from 3:00–7:00.'),
    ];
  }

  function deriveMainFormatFromTiming(timing) {
    if (timing === 'booked') return 'individual_booked';
    if (timing === 'assigned') return 'individual_assigned';
    if (timing === 'window') return 'arrival_window';
    if (timing === 'drop_in') return 'open_call';
    return null;
  }

  function inferMainTiming(format) {
    if (format === 'individual_booked') return 'booked';
    if (format === 'individual_assigned') return 'assigned';
    if (format === 'arrival_window') return 'window';
    if (format === 'open_call') return 'drop_in';
    return null;
  }

  function inferMainSeeing(format) {
    if (format === 'individual_booked' || format === 'individual_assigned' || format === 'video_submission' || format === 'video_live') return 'individual';
    if (format === 'arrival_window') return 'small_groups';
    if (format === 'open_call') return 'full_group';
    return null;
  }

  function deriveDanceFormat(setup) {
    const seeing = normalizeSeeingValue(setup?.seeing || null);
    const timing = setup?.timing || null;

    if (!seeing && !timing) return null;
    if (timing === 'assigned') return 'dance_assigned_groups';
    if (timing === 'booked') return 'dance_block';
    if (timing === 'window' || timing === 'drop_in') return 'dance_drop_in';
    if (seeing === 'small_group') return 'dance_group_split';
    if (seeing === 'individual') return 'dance_group_individual';
    if (seeing === 'full_group') return 'dance_group_full';
    return 'dance_other';
  }

  function inferDanceSetup(format) {
    const defaults = clone(DEFAULT_STATE.danceSetup);
    if (format === 'dance_group_full') return { ...defaults, seeing: 'full_group' };
    if (format === 'dance_group_split') return { ...defaults, seeing: 'small_group' };
    if (format === 'dance_block') return { ...defaults, seeing: 'small_group', timing: 'booked' };
    if (format === 'dance_group_individual') return { ...defaults, seeing: 'individual' };
    if (format === 'dance_assigned_groups') return { ...defaults, seeing: 'small_group', timing: 'assigned' };
    if (format === 'dance_drop_in') return { ...defaults, seeing: 'full_group', timing: 'drop_in' };
    if (format === 'dance_video') return { ...defaults, seeing: 'self_tape' };
    if (format === 'dance_video_live') return { ...defaults, seeing: 'video_call' };
    return defaults;
  }

  function deriveCallbackFormat(setup) {
    const timing = setup?.timing || 'assigned';
    const seeing = normalizeSeeingValue(setup?.seeing || 'individual');
    const content = Array.isArray(setup?.content) ? setup.content.filter(Boolean) : ['scene_work'];

    if (timing === 'window') {
      if (seeing === 'full_group') return 'callback_ensemble';
      if (seeing === 'small_groups') return 'callback_scene_groups';
      if (seeing === 'mixed') return 'callback_mixed';
      return 'callback_assigned';
    }
    if (content.includes('mixed') || content.length > 1 || seeing === 'mixed') return 'callback_mixed';
    if (content.includes('dance')) return 'callback_dance';
    if (content.includes('music')) return 'callback_music';
    if (seeing === 'small_groups') return 'callback_scene_groups';
    if (seeing === 'full_group') return 'callback_ensemble';
    if (timing === 'booking') return 'callback_booking';
    return 'callback_assigned';
  }

  function inferCallbackSetup(format) {
    const defaults = clone(DEFAULT_STATE.callbackSetup);
    if (format === 'callback_booking') return { ...defaults, timing: 'booking' };
    if (format === 'callback_scene_groups') return { ...defaults, seeing: 'small_groups' };
    if (format === 'callback_ensemble') return { ...defaults, seeing: 'full_group' };
    if (format === 'callback_workshop') return { ...defaults, seeing: 'mixed', content: ['mixed'] };
    if (format === 'callback_dance') return { ...defaults, content: ['dance'] };
    if (format === 'callback_music') return { ...defaults, content: ['music'] };
    if (format === 'callback_mixed') return { ...defaults, seeing: 'mixed', content: ['mixed'] };
    if (format === 'callback_video') return { ...defaults, timing: 'assigned' };
    if (format === 'callback_video_live') return { ...defaults, timing: 'assigned' };
    return defaults;
  }

  function activeRounds(state) {
    const shape = state.shape;
    return {
      main: true,
      dance: shape === 'main_dance' || shape === 'full_rounds',
      callback: shape === 'main_callbacks' || shape === 'full_rounds',
    };
  }

  function flowNeedsSlots(flow) {
    return [
      'individual_booked',
      'individual_assigned',
      'video_live',
      'dance_block',
      'dance_assigned_groups',
      'callback_assigned',
      'callback_booking',
      'callback_scene_groups',
      'callback_ensemble',
      'callback_dance',
      'callback_music',
      'callback_mixed',
    ].includes(flow);
  }

  function flowHelperCopy(flow) {
    const copyByFlow = {
      individual_booked: 'We’ll build a bookable time-slot schedule.',
      individual_assigned: 'We’ll build the session and a private timing structure you can manage yourself.',
      arrival_window: 'We’ll build an arrival window with no strict public slots.',
      open_call: 'We’ll build a drop-in window instead of strict time slots.',
      video_submission: 'We’ll build a Self Tape round with submission guidance instead of slots.',
      video_live: 'We’ll build a Video Call round with bookable timing.',
      hybrid: 'We’ll build flexible In Person, Video Call, and Self Tape options you can fine-tune after.',
      dance_group_full: 'We’ll build one shared dance-call block.',
      dance_group_split: 'We’ll build the dance round and leave room for smaller-group work.',
      dance_group_individual: 'We’ll build the dance round and note the individual moments in the instructions.',
      dance_block: 'We’ll build time blocks that can be used like group dance slots.',
      dance_assigned_groups: 'We’ll build the blocks and keep the flow internal.',
      dance_drop_in: 'We’ll build a drop-in dance window.',
      dance_video: 'We’ll build a Dance Self Tape round.',
      dance_video_live: 'We’ll build a dance round that happens by Video Call.',
      dance_other: 'We’ll build the dance round and leave it flexible so you can shape it later.',
      callback_assigned: 'We’ll build callback cards and keep timing internal by default.',
      callback_booking: 'We’ll build bookable callback slots.',
      callback_scene_groups: 'We’ll build callback blocks for grouped scene work.',
      callback_ensemble: 'We’ll build larger callback blocks for ensemble work.',
      callback_workshop: 'We’ll build a workshop-style callback block.',
      callback_dance: 'We’ll build a focused dance callback round.',
      callback_music: 'We’ll build a focused music callback round.',
      callback_mixed: 'We’ll build a mixed callback round with flexible timing.',
      callback_video: 'We’ll build a callback Self Tape round.',
      callback_video_live: 'We’ll build callbacks that happen by Video Call.',
    };
    return copyByFlow[flow] || 'We’ll build the closest version of this in your current audition system.';
  }

  function formatFlowLabel(flow) {
    const allOptions = MAIN_FORMAT_OPTIONS.concat(DANCE_FORMAT_OPTIONS, CALLBACK_FORMAT_OPTIONS);
    return allOptions.find(option => option.value === flow)?.label || flow;
  }

  function parseAgeRange(value) {
    const clean = String(value || '').trim();
    if (!clean) return { min: null, max: null };
    const rangeMatch = clean.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})/);
    if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
    const plusMatch = clean.match(/(\d{1,2})\s*\+/);
    if (plusMatch) return { min: Number(plusMatch[1]), max: null };
    return { min: null, max: null };
  }

  function buildPrepLines(state) {
    const lines = [];
    const prepSet = new Set(state.prep || []);
    const prepDetails = state.prepDetails || {};
    const detail = key => String(prepDetails[key] || '').trim();
    if (prepSet.has('short_song')) lines.push(detail('short_song') ? `Prepare a short song. ${detail('short_song')}` : 'Prepare a short song, around 16 bars or about one minute.');
    if (prepSet.has('monologue')) lines.push(detail('monologue') ? `Bring a monologue. ${detail('monologue')}` : 'Bring a short monologue.');
    if (prepSet.has('optional_monologue')) lines.push(detail('optional_monologue') ? `A monologue is welcome, but optional. ${detail('optional_monologue')}` : 'A monologue is welcome, but optional.');
    if (prepSet.has('movement_clothes')) lines.push(detail('movement_clothes') ? `Wear comfortable clothes for movement. ${detail('movement_clothes')}` : 'Wear comfortable clothes you can move in.');
    if (prepSet.has('teach_here')) lines.push(detail('teach_here') ? `We will teach material in the room. ${detail('teach_here')}` : 'We will teach material in the room.');
    if (prepSet.has('nothing_special')) lines.push('No special preparation is needed.');
    if (state.prepCustom && state.prepCustom.trim()) lines.push(state.prepCustom.trim());
    if (!lines.length) lines.push('We will share anything performers need before they arrive.');
    return lines;
  }

  function buildPrepText(state) {
    return buildPrepLines(state).map(line => `<p>${escapeHtml(line)}</p>`).join('');
  }

  function buildAccessOptionLines(state) {
    const modes = new Set(state.accessModes || []);
    const lines = [];
    if (modes.has('video_call')) {
      lines.push('If someone cannot make it on the day or will not be in the area, you can offer a live video-call option.');
    }
    if (modes.has('self_tape')) {
      lines.push('If someone cannot make it on the day or will not be in the area, you can offer a self-tape option.');
    }
    return lines;
  }

  function buildAboutText(state, prod) {
    const lines = [];
    if (prod?.title) lines.push(`We are excited to see performers for ${prod.title}.`);
    else lines.push('We are excited to see performers for this production.');
    if (state.ageRange) lines.push(`These auditions are intended for ${state.ageRange}.`);
    const rounds = activeRounds(state);
    if (rounds.dance && rounds.callback) lines.push('This process includes a main audition, a dance call, and callbacks.');
    else if (rounds.dance) lines.push('This process includes a main audition and a separate dance call.');
    else if (rounds.callback) lines.push('This process includes a main audition and callbacks.');
    else lines.push('This process starts with one main audition round.');
    return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  }

  function expectationForFlow(flow, label) {
    const copyByFlow = {
      individual_booked: `Performers will choose a specific time for the ${label}.`,
      individual_assigned: `We will assign times for the ${label} and share them directly with performers.`,
      arrival_window: `Performers will arrive during a set window for the ${label}, and we will call them in one by one.`,
      open_call: `Performers can drop in during the ${label} window and will be seen as space opens up.`,
      video_submission: `Performers will submit a self tape for the ${label} instead of attending in person.`,
      video_live: `Performers will audition live by video call instead of attending in person.`,
      hybrid: `Performers can take part in the ${label} in person, by video call, or by self tape.`,
      dance_group_full: 'The dance call will be taught and assessed as one shared group.',
      dance_group_split: 'The dance call will begin together, then move into smaller groups.',
      dance_group_individual: 'The dance call will include group work plus short individual moments.',
      dance_block: 'The dance call will run in timed group blocks.',
      dance_assigned_groups: 'Dance groups will be assigned internally.',
      dance_drop_in: 'Performers can arrive during the dance-call window and groups will be formed as needed.',
      dance_video: 'Performers can submit dance material by self tape.',
      dance_video_live: 'The dance call will happen live by video call instead of in person.',
      dance_other: 'We’ll share the dance-call details with performers once you’ve shaped the round.',
      callback_assigned: 'Callback times will be assigned by the team.',
      callback_booking: 'Invited performers can choose a callback time.',
      callback_scene_groups: 'Callbacks will be run in small scene-work groups.',
      callback_ensemble: 'Callbacks will focus on larger-group work and blend.',
      callback_workshop: 'Callbacks will run as a longer workshop-style session.',
      callback_dance: 'Callbacks will focus on detailed dance work.',
      callback_music: 'Callbacks will focus on music and vocal work.',
      callback_mixed: 'Callbacks will mix acting, singing, and movement as needed.',
      callback_video: 'Callbacks can be submitted by self tape when needed.',
      callback_video_live: 'Callbacks will happen live by video call instead of in person.',
    };
    return copyByFlow[flow] || `We will share the details for the ${label} with performers.`;
  }

  function buildExpectText(state) {
    const lines = [expectationForFlow(state.mainFormat, 'main audition')];
    const rounds = activeRounds(state);
    if (rounds.dance) lines.push(expectationForFlow(state.danceFormat, 'dance call'));
    if (rounds.callback) lines.push(expectationForFlow(state.callbackFormat, 'callback'));
    lines.push(...buildAccessOptionLines(state));
    return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  }

  function buildPlainPrepList(state) {
    const lines = [];
    const prepSet = new Set(state.prep || []);
    const prepDetails = state.prepDetails || {};
    const detail = key => String(prepDetails[key] || '').trim();
    if (prepSet.has('short_song')) lines.push(detail('short_song') ? `Ask performers to prepare a short song. ${detail('short_song')}` : 'Ask performers to prepare a short song.');
    if (prepSet.has('monologue')) lines.push(detail('monologue') ? `Ask performers to bring a monologue. ${detail('monologue')}` : 'Ask performers to bring a monologue.');
    if (prepSet.has('optional_monologue')) lines.push(detail('optional_monologue') ? `A monologue can be optional. ${detail('optional_monologue')}` : 'A monologue can be optional.');
    if (prepSet.has('movement_clothes')) lines.push(detail('movement_clothes') ? `Let them know what to wear for movement. ${detail('movement_clothes')}` : 'Let them know to wear clothes they can move in.');
    if (prepSet.has('teach_here')) lines.push(detail('teach_here') ? `You can teach material in the room. ${detail('teach_here')}` : 'You can teach material in the room.');
    if (state.prepCustom && state.prepCustom.trim()) lines.push(state.prepCustom.trim());
    return lines.join(' ');
  }

  function buildSessionInstructions(state, flow, roundName) {
    const lines = [expectationForFlow(flow, roundName.toLowerCase())];
    const prepText = buildPlainPrepList(state);
    if (prepText) lines.push(prepText);
    lines.push(...buildAccessOptionLines(state));
    return lines.join(' ');
  }

  function sessionBehavior(flow, roundType) {
    const behavior = {
      sessionFormat: 'in_person',
      bookingMode: 'timed',
      shouldGenerateSlots: false,
      isVisible: roundType !== 'callback',
      slotLength: 10,
      buffer: 0,
      capacity: 1,
    };

    if (flow === 'individual_booked') {
      behavior.shouldGenerateSlots = true;
    } else if (flow === 'individual_assigned') {
      behavior.shouldGenerateSlots = true;
      behavior.isVisible = false;
    } else if (flow === 'arrival_window' || flow === 'open_call') {
      behavior.bookingMode = 'open';
    } else if (flow === 'video_submission') {
      behavior.sessionFormat = 'virtual';
    } else if (flow === 'video_live') {
      behavior.sessionFormat = 'virtual';
      behavior.shouldGenerateSlots = true;
    } else if (flow === 'hybrid') {
      behavior.sessionFormat = 'hybrid';
      behavior.shouldGenerateSlots = true;
    } else if (flow === 'dance_group_full' || flow === 'dance_group_split' || flow === 'dance_group_individual') {
      behavior.bookingMode = 'open';
      behavior.capacity = 20;
    } else if (flow === 'dance_block') {
      behavior.shouldGenerateSlots = true;
      behavior.slotLength = 60;
      behavior.capacity = 18;
    } else if (flow === 'dance_assigned_groups') {
      behavior.shouldGenerateSlots = true;
      behavior.isVisible = false;
      behavior.slotLength = 60;
      behavior.capacity = 18;
    } else if (flow === 'dance_drop_in') {
      behavior.bookingMode = 'open';
      behavior.capacity = 20;
    } else if (flow === 'dance_video') {
      behavior.sessionFormat = 'virtual';
    } else if (flow === 'dance_video_live') {
      behavior.sessionFormat = 'virtual';
      behavior.shouldGenerateSlots = true;
      behavior.capacity = 20;
    } else if (flow === 'dance_other') {
      behavior.bookingMode = 'open';
    } else if (flow === 'callback_assigned') {
      behavior.shouldGenerateSlots = true;
      behavior.isVisible = false;
    } else if (flow === 'callback_booking') {
      behavior.shouldGenerateSlots = true;
    } else if (flow === 'callback_scene_groups') {
      behavior.shouldGenerateSlots = true;
      behavior.capacity = 4;
      behavior.slotLength = 20;
    } else if (flow === 'callback_ensemble') {
      behavior.shouldGenerateSlots = true;
      behavior.capacity = 12;
      behavior.slotLength = 30;
    } else if (flow === 'callback_workshop') {
      behavior.bookingMode = 'open';
      behavior.isVisible = false;
    } else if (flow === 'callback_dance') {
      behavior.shouldGenerateSlots = true;
      behavior.capacity = 12;
      behavior.slotLength = 30;
    } else if (flow === 'callback_music') {
      behavior.shouldGenerateSlots = true;
      behavior.slotLength = 10;
    } else if (flow === 'callback_mixed') {
      behavior.shouldGenerateSlots = true;
      behavior.slotLength = 15;
    } else if (flow === 'callback_video') {
      behavior.sessionFormat = 'virtual';
      behavior.isVisible = false;
    } else if (flow === 'callback_video_live') {
      behavior.sessionFormat = 'virtual';
      behavior.shouldGenerateSlots = true;
      behavior.isVisible = false;
    }

    return behavior;
  }

  function buildSessionPayload(options) {
    const { prodId, state, roundType, name, flow, scheduleValues, sortOrder, seeing } = options;
    const behavior = sessionBehavior(flow, roundType);
    const roundValues = resolveRoundScheduleValues(roundType, flow, seeing, scheduleValues || {});
    const slotLength = Number(roundValues.slotLength || behavior.slotLength || 10);
    const buffer = Number(roundValues.buffer || behavior.buffer || 0);
    const capacity = Number(roundValues.capacity || behavior.capacity || 1);
    const blockId = `blk_${roundType}_${Date.now()}`;
    const hasDateTime = roundValues.date && roundValues.start && roundValues.end;
    const slotBlocks = behavior.shouldGenerateSlots && hasDateTime ? [{
      id: blockId,
      date: roundValues.date,
      start_time: roundValues.start,
      end_time: roundValues.end,
      slot_length: slotLength,
      buffer,
      capacity,
      visibility: 'public',
      breaks: [],
    }] : [];

    return {
      row: {
        production_id: prodId,
        name,
        type: roundType,
        format: behavior.sessionFormat,
        booking_mode: behavior.bookingMode,
        date: roundValues.date || null,
        start_time: roundValues.start || null,
        end_time: roundValues.end || null,
        location: state.location || null,
        instructions: buildSessionInstructions(state, flow, name),
        is_visible: behavior.isVisible,
        show_to_applicants: behavior.isVisible,
        sort_order: sortOrder,
        slot_blocks: slotBlocks,
      },
      blockId,
      shouldGenerateSlots: behavior.shouldGenerateSlots && hasDateTime,
      slotLength,
      buffer,
      capacity,
    };
  }

  function buildSlotRows(options) {
    const { sessionId, blockId, scheduleValues, slotLength, buffer, capacity } = options;
    const date = scheduleValues.date;
    const start = scheduleValues.start;
    const end = scheduleValues.end;
    if (!date || !start || !end) return [];

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    let current = (startHour * 60) + startMinute;
    const endMins = (endHour * 60) + endMinute;
    const duration = Number(slotLength || 10) + Number(buffer || 0);
    const rows = [];

    while (current + Number(slotLength || 10) <= endMins) {
      const hour = String(Math.floor(current / 60)).padStart(2, '0');
      const minute = String(current % 60).padStart(2, '0');
      rows.push({
        session_id: sessionId,
        block_id: blockId,
        slot_date: date,
        slot_time: `${hour}:${minute}:00`,
        capacity: Number(capacity || 1),
        is_available: true,
        label: 'Open',
      });
      current += duration;
    }

    return rows;
  }

  function buildQuestionPayload(state) {
    const activitySet = new Set(collectActivityValues(state));
    return {
      section_actor: true,
      section_guardian: true,
      section_headshot: true,
      section_conflicts: !!state.collect.conflicts,
      section_acting: activitySet.has('read') || activitySet.has('mix'),
      section_vocal: activitySet.has('sing') || activitySet.has('mix'),
      section_dance: activitySet.has('dance') || activitySet.has('move_group') || activitySet.has('mix'),
      section_special_skills: activitySet.has('dance') || activitySet.has('move_group') || activitySet.has('mix'),
      section_previous_experience: !!state.collect.experience,
      section_roles: !!state.collect.casting_preference,
    };
  }

  function starterCharacters(state) {
    const prepText = stripHtml(buildPrepText(state));
    const callbackText = activeRounds(state).callback ? 'We will share callback material after invitations go out.' : null;
    if (state.characterSetup === 'sort_out_later' || state.characterSetup === 'ai_import') return [];
    if (state.characterSetup === 'manual_now' && state.characterWhen === 'later') return [];
    // manual_now + now: give a simple starter structure they can build on
    return [
      { name: 'Lead Roles', role_type: 'Principal', performer_count: 1, description: 'A starter place for your named lead roles.', audition_material: prepText, callback_material: callbackText },
      { name: 'Supporting Roles', role_type: 'Supporting', performer_count: 1, description: 'A starter place for supporting characters.', audition_material: prepText, callback_material: callbackText },
      { name: 'Ensemble', role_type: 'Group', performer_count: 10, description: 'A flexible group card for chorus, featured ensemble, or swing space.', audition_material: prepText, callback_material: callbackText },
    ];
  }

  async function buildAuditionSystem(options) {
    const { sb, prodId, prod, wizardState } = options;
    const { data: existingConfig } = await sb.from('audition_configs').select('*').eq('production_id', prodId).maybeSingle();
    const { data: existingSessions } = await sb.from('audition_sessions').select('*').eq('production_id', prodId).in('type', ['audition', 'dance_call', 'callback']);

    const { data: prodRow } = await sb.from('productions').select('wizard_data').eq('id', prodId).single();
    const wizardData = prodRow?.wizard_data || {};
    wizardData.audition_builder = {
      ...wizardState,
      rounds_enabled: activeRounds(wizardState),
      built_from_wizard: true,
      built_at: new Date().toISOString(),
    };

    const age = parseAgeRange(wizardState.ageRange);
    const prodUpdate = { wizard_data: wizardData };
    if (wizardState.location && !prod?.audition_location) prodUpdate.audition_location = wizardState.location;
    if (age.min !== null) prodUpdate.age_min = age.min;
    if (age.max !== null) prodUpdate.age_max = age.max;
    await sb.from('productions').update(prodUpdate).eq('id', prodId);

    const questionPayload = buildQuestionPayload(wizardState);
    const configPayload = {
      about_text: buildAboutText(wizardState, prod),
      prepare_text: buildPrepText(wizardState),
      expect_text: buildExpectText(wizardState),
      ...questionPayload,
    };

    let configId = existingConfig?.id || null;
    if (!configId) {
      const { data: insertedConfig, error: configInsertError } = await sb.from('audition_configs').insert({
        production_id: prodId,
        is_open: existingConfig?.is_open || false,
        ...configPayload,
      }).select().single();
      if (configInsertError) throw configInsertError;
      configId = insertedConfig.id;
    } else {
      const { error: configUpdateError } = await sb.from('audition_configs').update(configPayload).eq('id', configId);
      if (configUpdateError) throw configUpdateError;
    }

    const existingSessionIds = (existingSessions || []).map(session => session.id);
    if (existingSessionIds.length) {
      await sb.from('audition_time_slots').delete().in('session_id', existingSessionIds);
      await sb.from('audition_sessions').delete().in('id', existingSessionIds);
    }

    const rounds = activeRounds(wizardState);
    const sessionPayloads = [
      buildSessionPayload({
        prodId,
        state: wizardState,
        roundType: 'audition',
        name: 'General Audition',
        flow: wizardState.mainFormat,
        seeing: wizardState.mainSeeing,
        scheduleValues: wizardState.rounds.main,
        sortOrder: 0,
      }),
    ];
    if (rounds.dance) {
      sessionPayloads.push(buildSessionPayload({
        prodId,
        state: wizardState,
        roundType: 'dance_call',
        name: 'Dance Call',
        flow: wizardState.danceFormat,
        seeing: wizardState.danceSetup?.seeing,
        scheduleValues: wizardState.rounds.dance,
        sortOrder: 1,
      }));
    }
    if (rounds.callback) {
      sessionPayloads.push(buildSessionPayload({
        prodId,
        state: wizardState,
        roundType: 'callback',
        name: 'Callback',
        flow: wizardState.callbackFormat,
        seeing: wizardState.callbackSetup?.seeing,
        scheduleValues: wizardState.rounds.callback,
        sortOrder: 2,
      }));
    }

    const { data: insertedSessions, error: insertSessionsError } = await sb.from('audition_sessions').insert(sessionPayloads.map(payload => payload.row)).select();
    if (insertSessionsError) throw insertSessionsError;

    const slotRows = [];
    (insertedSessions || []).forEach((session, index) => {
      const payload = sessionPayloads[index];
      if (!payload?.shouldGenerateSlots) return;
      const scheduleValues = payload.row.type === 'audition'
        ? wizardState.rounds.main
        : payload.row.type === 'dance_call'
          ? wizardState.rounds.dance
          : wizardState.rounds.callback;
      slotRows.push(...buildSlotRows({
        sessionId: session.id,
        blockId: payload.blockId,
        scheduleValues,
        slotLength: payload.slotLength,
        buffer: payload.buffer,
        capacity: payload.capacity,
      }));
    });

    if (slotRows.length) {
      const { error: slotsError } = await sb.from('audition_time_slots').insert(slotRows);
      if (slotsError) throw slotsError;
    }

    const { data: existingCharacters } = await sb.from('production_characters').select('id').eq('production_id', prodId);
    if (!(existingCharacters || []).length) {
      const starter = starterCharacters(wizardState);
      if (starter.length) {
        const rows = starter.map((character, index) => ({
          production_id: prodId,
          name: character.name,
          role_type: character.role_type,
          performer_count: character.performer_count,
          description: character.description,
          audition_material: character.audition_material,
          callback_material: character.callback_material,
          show_on_form: true,
          show_on_public_page: true,
          sort_order: index,
        }));
        const { error: charactersError } = await sb.from('production_characters').insert(rows);
        if (charactersError) throw charactersError;
      }
    }

    if (wizardState.collect.extra_notes) {
      const { data: existingQuestions } = await sb.from('audition_custom_questions').select('id, question_text').eq('production_id', prodId);
      const hasExtraNotes = (existingQuestions || []).some(question => String(question.question_text || '').toLowerCase().includes('anything else'));
      if (!hasExtraNotes) {
        const { error: questionError } = await sb.from('audition_custom_questions').insert({
          production_id: prodId,
          question_text: 'Anything else you want us to know before auditions?',
          question_type: 'textarea',
          required: false,
          sort_order: (existingQuestions || []).length,
        });
        if (questionError) throw questionError;
      }
    }

    const typeMap = { audition: 'audition', dance_call: 'dance_call', callback: 'callback' };
    await sb.from('production_events').delete().eq('production_id', prodId).in('event_type', ['audition', 'dance_call', 'callback']);

    const eventRows = (insertedSessions || [])
      .filter(session => session.date && typeMap[session.type])
      .map(session => {
        const hasTime = session.start_time && session.end_time;
        const normalizeTime = value => (value && value.split(':').length >= 3) ? value : `${value}:00`;
        return {
          production_id: prodId,
          title: session.name,
          event_type: typeMap[session.type],
          start_time: hasTime ? `${session.date}T${normalizeTime(session.start_time)}` : `${session.date}T00:00:00`,
          end_time: hasTime ? `${session.date}T${normalizeTime(session.end_time)}` : null,
          all_day: !hasTime,
          venue: session.location || null,
        };
      });

    if (eventRows.length) {
      const { error: eventsError } = await sb.from('production_events').insert(eventRows);
      if (eventsError) throw eventsError;
    }

    return {
      configId,
      insertedSessions: insertedSessions || [],
      slotCount: slotRows.length,
      roundsEnabled: rounds,
      wizardData,
      questionPayload,
    };
  }

  async function saveAuditionBuilderDraft(options) {
    const { sb, prodId, prod, wizardState, currentStep } = options;
    const { data: prodRow } = await sb.from('productions').select('wizard_data').eq('id', prodId).single();
    const wizardData = prodRow?.wizard_data || {};
    wizardData.audition_builder = {
      ...wizardState,
      rounds_enabled: activeRounds(wizardState),
      current_step: currentStep,
      is_draft: true,
      saved_at: new Date().toISOString(),
    };

    const age = parseAgeRange(wizardState.ageRange);
    const prodUpdate = { wizard_data: wizardData };
    if (wizardState.location && !prod?.audition_location) prodUpdate.audition_location = wizardState.location;
    if (age.min !== null) prodUpdate.age_min = age.min;
    if (age.max !== null) prodUpdate.age_max = age.max;
    await sb.from('productions').update(prodUpdate).eq('id', prodId);

    return wizardData.audition_builder;
  }

  async function deleteAuditionBuilderDraft(options) {
    const { sb, prodId } = options;
    const { data: prodRow } = await sb.from('productions').select('wizard_data').eq('id', prodId).single();
    const wizardData = { ...(prodRow?.wizard_data || {}) };
    delete wizardData.audition_builder;
    await sb.from('productions').update({ wizard_data: wizardData }).eq('id', prodId);
    return wizardData;
  }

  window.BTSAuditionBuilderEngine = {
    AUDITION_SHAPES,
    MAIN_SEEN_OPTIONS,
    MAIN_TIMING_OPTIONS,
    DANCE_FORMAT_OPTIONS,
    DANCE_SEEN_OPTIONS,
    DANCE_TIMING_OPTIONS,
    OTHER_SEEN_OPTIONS,
    OTHER_TIMING_OPTIONS,
    CALLBACK_FORMAT_OPTIONS,
    CALLBACK_TIMING_OPTIONS,
    CALLBACK_SEEN_OPTIONS,
    CALLBACK_CONTENT_OPTIONS,
    ACTIVITY_OPTIONS,
    ROUND_ACTIVITY_OPTIONS,
    activityOptionsForRound,
    collectActivityValues,
    PREP_OPTIONS,
    COLLECT_OPTIONS,
    CHARACTER_SETUP_OPTIONS,
    DEFAULT_STATE,
    createDefaultState,
    getMainTimingOptions,
    getDanceTimingOptions,
    getCallbackTimingOptions,
    getOtherTimingOptions,
    deriveMainFormatFromTiming,
    inferMainTiming,
    inferMainSeeing,
    deriveDanceFormat,
    inferDanceSetup,
    deriveCallbackFormat,
    inferCallbackSetup,
    activeRounds,
    flowNeedsSlots,
    flowHelperCopy,
    formatFlowLabel,
    resolveRoundScheduleValues,
    parseAgeRange,
    buildPrepText,
    buildAboutText,
    buildExpectText,
    buildQuestionPayload,
    starterCharacters,
    saveAuditionBuilderDraft,
    deleteAuditionBuilderDraft,
    buildAuditionSystem,
  };
})();
