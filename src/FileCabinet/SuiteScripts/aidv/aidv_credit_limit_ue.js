/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * Hard credit-limit block on sales orders. NetSuite's native credit check only warns
 * in the UI; this one also stops orders created through REST, CSV import and
 * integrations (e.g. the shopify-erp-order-sync service), because User Events run for all contexts.
 */
define(['N/error', './aidv_credit_lib'], (error, credit) => {
  function beforeSubmit(context) {
    const { CREATE, EDIT, XEDIT } = context.UserEventType;
    if (![CREATE, EDIT, XEDIT].includes(context.type)) return;

    const so = context.newRecord;
    // XEDIT (inline edit) carries only changed fields — fall back to the saved record.
    const customerId = so.getValue('entity') || context.oldRecord?.getValue('entity');
    const orderTotal = Number(so.getValue('total') ?? context.oldRecord?.getValue('total') ?? 0);
    if (!customerId) return;

    if (credit.exceedsLimit({ customerId, orderId: so.id, orderTotal })) {
      throw error.create({ name: 'AIDV_CREDIT_LIMIT', message: credit.CREDIT_MESSAGE, notifyOff: true });
    }
  }

  return { beforeSubmit };
});
