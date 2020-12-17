import deleteOutdatedDiscountsFromCarts from "./jobs/deleteOutdatedDiscountsFromCarts.js";

/**
 * @summary Called on startup
 * @param {Object} context Startup context
 * @param {Object} context.collections Map of MongoDB collections
 * @returns {undefined}
 */
export default async function startup(context) {
  const {
    appEvents,
    collections: { Discounts },
  } = context;

  await deleteOutdatedDiscountsFromCarts(context);

  const jobOptions = {
    type: "discounts/deleteOutdated",
    data: {},
    retry: {
      retries: 3,
      wait: 60000,
      backoff: "exponential",
    },
    priority: "high",
    // fires at 2:00am every day
    schedule: "at 2:00 am",
    cancelRepeats: true,
  };

  // // First cancel any existing job with same data. We can't use `cancelRepeats` option
  // // on `scheduleJob` because that cancels all of that type, whereas we want to
  // // cancel only those with the same type AND the same shopId and notify ID.
  await context.backgroundJobs.cancelJobs(jobOptions);
  await context.backgroundJobs.scheduleJob(jobOptions);

  appEvents.on("afterOrderCreate", async ({ order }) => {
    if (Array.isArray(order.discounts)) {
      await Promise.all(
        order.discounts.map(async (orderDiscount) => {
          const { discountId } = orderDiscount;
          const transaction = {
            appliedAt: new Date(),
            cartId: order.cartId,
            userId: order.accountId,
          };

          await Discounts.updateOne(
            { _id: discountId },
            { $addToSet: { transactions: transaction } }
          );
        })
      );
    }
  });
}
