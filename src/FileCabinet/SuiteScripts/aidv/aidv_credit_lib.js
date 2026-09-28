/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Credit exposure for a customer: A/R balance + open sales orders (other than the one
 * being saved). Shared by the User Event and the Suitelet.
 */
define(['N/query', 'N/search'], (query, search) => {
  // Sales order statuses that still represent open, unbilled value.
  const OPEN_SO_STATUSES = ['SalesOrd:A', 'SalesOrd:B', 'SalesOrd:D', 'SalesOrd:E', 'SalesOrd:F'];
  const CREDIT_MESSAGE = 'Order exceeds customer credit limit';

  const inList = (values) => values.map((v) => `'${v}'`).join(', ');

  function openOrdersTotal(customerId, excludeOrderId) {
    const rows = query.runSuiteQL({
      query: `
        SELECT NVL(SUM(t.foreigntotal), 0) AS total
        FROM transaction t
        WHERE t.type = 'SalesOrd'
          AND t.entity = ?
          AND t.status IN (${inList(OPEN_SO_STATUSES)})
          AND t.id <> ?`,
      params: [customerId, excludeOrderId || -1],
    }).asMappedResults();
    return Number(rows[0]?.total || 0);
  }

  /** @returns {{limit:number, balance:number}} limit 0 = no limit */
  function creditTerms(customerId) {
    const f = search.lookupFields({ type: search.Type.CUSTOMER, id: customerId, columns: ['creditlimit', 'balance'] });
    return { limit: Number(f.creditlimit || 0), balance: Number(f.balance || 0) };
  }

  function exceedsLimit({ customerId, orderId, orderTotal }) {
    const { limit, balance } = creditTerms(customerId);
    if (!limit) return false;
    return balance + openOrdersTotal(customerId, orderId) + orderTotal > limit;
  }

  return { CREDIT_MESSAGE, OPEN_SO_STATUSES, openOrdersTotal, creditTerms, exceedsLimit };
});
