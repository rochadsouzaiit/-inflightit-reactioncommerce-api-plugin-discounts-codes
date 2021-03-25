import ReactionError from "@reactioncommerce/reaction-error";

/**
 * @name discountsFromCart
 * @method
 * @memberof GraphQL/DiscountsFromCart
 * @summary Query cart to get applied discounts
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - an object of all mutation arguments that were sent by the client
 * @param {Object} input.cartId - Cart to get discount from
 * @param {String} input.shopId - Shop cart belongs to
 * @param {Object} filters - filters to be applied
 * @returns {Promise<{_id: string, code: string}[]>} Discount reprensentation on cart array Promise
 */
export default async function discountsFromCart(context, input) {
  const { cartId, shopId } = input;
  const { collections } = context;
  const { Cart } = collections;


  const cart = await Cart.findOne({ _id: cartId, shopId });
  if (!cart) {
    throw new ReactionError(
      "error-occurred",
      `SERVER.ECOMMERCE.DISCOUNTS.THERE_IS_NO_CART_WITH_THE_PROVIDE_ID_${cartId}`
    );
  }

  await context.validatePermissions(`reaction:legacy:carts:${cartId}`, "update", {
    shopId,
    owner: cart.accountId
  });


  const appliedDiscounts = (cart.billing || []).map(({ _id, data }) => ({ _id, code: data.code }));

  return appliedDiscounts;
}
