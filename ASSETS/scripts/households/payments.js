/* Read-only projection of the existing production fee settings and recorded payments. */
(function () {
  'use strict';
  const amount = value => Math.round((parseFloat(String(value || '').replace(/[^0-9.-]/g, '')) || 0) * 100);
  function summary(invoice) {
    const settings = invoice.settings || {};
    const base = !settings.mode || settings.mode === 'none' ? [] : settings.mode === 'split'
      ? (settings.split_installments || []).map((row, i) => ({ label: i === 0 ? 'First payment' : 'Payment ' + (i + 1), due: row.due_date || '', cents: amount(row.amount) }))
      : [{ label:'Registration fee', due:settings.fee_due_date || '', cents:amount(settings.fee) }];
    const baseTotal = base.reduce((sum, row) => sum + row.cents, 0);
    const schedule = base.map(row => ({ ...row, cents:0 }));
    let total = 0;
    let discount = 0;
    const bills = (invoice.bills || []).filter(bill => !bill.dropped_out);
    const earned = bill => bill.volunteer_discount_earned === true || bill.volunteer_discount_approved === true;
    const groupEarned = bills.some(earned);
    const perChild = bills.some(bill => bill.volunteer_discount_per_child);
    const individualSchedules = {};
    for (const bill of bills) {
      let effectiveBase = baseTotal;
      let credit = 0;
      if (settings.sibling_discount_enabled && invoice.shared_invoice) {
        const siblingRate = amount(Number(bill.household_position) === 0 ? settings.sibling_first_child : settings.sibling_additional);
        if (siblingRate > 0) effectiveBase = siblingRate;
      }
      const volunteerApplies = invoice.shared_invoice ? groupEarned && (perChild || Number(bill.household_position) === 0) : earned(bill);
      if (settings.volunteer_discount_enabled && volunteerApplies) credit += amount(settings.volunteer_discount);
      if (bill.scholarship_status === 'approved') credit += amount(bill.scholarship_amount);
      const payableTotal = Math.max(0, effectiveBase - credit);
      credit = Math.max(0, baseTotal - payableTotal);
      const adjusted = base.map(row => row.cents);
      if (payableTotal > baseTotal && adjusted.length) adjusted[0] += payableTotal-baseTotal;
      for (let i = adjusted.length - 1; i >= 0 && credit > 0; i--) {
        const used = Math.min(adjusted[i], credit);adjusted[i] -= used;credit -= used;
      }
      individualSchedules[bill.id] = adjusted;
      adjusted.forEach((cents, i) => { schedule[i].cents += cents; });
      const payable = adjusted.reduce((sum, cents) => sum + cents, 0);
      total += payable;discount += baseTotal - payable;
    }
    let paid = 0;
    const records = (invoice.payments || []).filter(row => row.paid).map(row => {
      // Historical paid records without an explicit amount use their scheduled instalment.
      const cents = row.amount_cents == null ? (individualSchedules[row.casting_assignment_id]?.[Number(row.installment_index)] ?? schedule[Number(row.installment_index)]?.cents ?? 0) : Number(row.amount_cents);
      paid += cents;return { ...row, cents };
    });
    let cumulative = 0;
    const due = schedule.map(row => { cumulative += row.cents;return { ...row, remaining:Math.max(0, Math.min(row.cents, cumulative - paid)) }; });
    return { total, paid, balance:Math.max(0, total-paid), credit:Math.max(0, paid-total), discount, schedule:due, records, currency:String(settings.currency || 'CAD').toUpperCase() };
  }
  window.BTSFamilyPayments = { summary };
}());
