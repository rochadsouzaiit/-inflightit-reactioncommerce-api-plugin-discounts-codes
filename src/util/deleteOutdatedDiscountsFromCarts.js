import Logger from "@reactioncommerce/logger";

/**
 * @name deleteOutdatedDiscountsFromCarts
 * @summary Delete outdated Discounts from abandoned carts
 * @param {Object} context App context
 * @returns {undefined}
 */
export default async function deleteOutdatedDiscountsFromCartsFn(context) {
  Logger.debug("Deleting outdated discounts from carts");
  const timeStart = new Date();
  const {
    collections: { Discounts, Cart },
  } = context;

  // Get abandoned carts and remove vouchers
  const twoHoursAgo = new Date();
  twoHoursAgo.setHours(d.getHours() - 2);

  await Cart.updateMany(
    {
      updatedAt: {
        $lt: twoHoursAgo,
      },
      billing: { $exists: true },
    },
    { $unset: { billing: 1 }, $set: { discount: 0 } }
  );
  const timeEnd = new Date();
  const timeDiff = timeEnd.getTime() - timeStart.getTime();
  Logger.debug(`Deleting outdated discounts. Took ${timeDiff}ms`);
}
