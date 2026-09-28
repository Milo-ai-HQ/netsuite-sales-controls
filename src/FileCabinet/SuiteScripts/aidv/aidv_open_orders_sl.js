/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * "Open Orders by Customer": one row per customer with open order count, value,
 * oldest order date, credit limit and remaining headroom. Optional date filter.
 */
define(['N/ui/serverWidget', 'N/query', './aidv_credit_lib'], (ui, query, credit) => {
  function onRequest(context) {
    const { custpage_from: from, custpage_to: to } = context.request.parameters;
    const form = ui.createForm({ title: 'Open Orders by Customer' });

    form.addField({ id: 'custpage_from', type: ui.FieldType.DATE, label: 'Order date from' }).defaultValue = from || null;
    form.addField({ id: 'custpage_to', type: ui.FieldType.DATE, label: 'Order date to' }).defaultValue = to || null;
    form.addSubmitButton({ label: 'Refresh' });

    const params = [];
    let dateFilter = '';
    // DATE fields post in the user's date format; this deployment assumes MM/DD/YYYY.
    if (from) { dateFilter += ` AND t.trandate >= TO_DATE(?, 'MM/DD/YYYY')`; params.push(from); }
    if (to) { dateFilter += ` AND t.trandate <= TO_DATE(?, 'MM/DD/YYYY')`; params.push(to); }

    const rows = query.runSuiteQL({
      query: `
        SELECT t.entity AS customer_id,
               BUILTIN.DF(t.entity) AS customer,
               COUNT(*) AS order_count,
               SUM(t.foreigntotal) AS open_amount,
               MIN(t.trandate) AS oldest
        FROM transaction t
        WHERE t.type = 'SalesOrd'
          AND t.status IN (${credit.OPEN_SO_STATUSES.map((s) => `'${s}'`).join(', ')})
          ${dateFilter}
        GROUP BY t.entity, BUILTIN.DF(t.entity)
        ORDER BY open_amount DESC`,
      params,
    }).asMappedResults();

    const list = form.addSublist({ id: 'custpage_rows', type: ui.SublistType.LIST, label: `Customers (${rows.length})` });
    const cols = [
      ['customer', 'Customer', ui.FieldType.TEXT],
      ['order_count', 'Open orders', ui.FieldType.INTEGER],
      ['open_amount', 'Open value', ui.FieldType.CURRENCY],
      ['oldest', 'Oldest order', ui.FieldType.TEXT],
      ['credit_limit', 'Credit limit', ui.FieldType.CURRENCY],
      ['headroom', 'Headroom', ui.FieldType.CURRENCY],
    ];
    cols.forEach(([id, label, type]) => list.addField({ id: `custpage_${id}`, label, type }));

    rows.forEach((r, line) => {
      const { limit, balance } = credit.creditTerms(r.customer_id);
      const headroom = limit ? limit - balance - Number(r.open_amount || 0) : null;
      const values = { ...r, credit_limit: limit || null, headroom };
      cols.forEach(([id]) => {
        if (values[id] !== null && values[id] !== undefined && values[id] !== '') {
          list.setSublistValue({ id: `custpage_${id}`, line, value: String(values[id]) });
        }
      });
    });

    context.response.writePage(form);
  }

  return { onRequest };
});
