import { decodeShopOpaqueId, decodeCartOpaqueId } from "../../xforms/id.js";

/**
 * @name Query/discountFromCart
 * @method
 * @memberof DiscountsFromCart/Query
 * @summary query the Discount codes collection and return user account data
 * @param {Object} _ - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {String} args.shopId - id of the shop
 * @param {String} args.cartId - id of the cart
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Object>} An array of discount codes
 */
export default async function discountFromCart(_, args, context) {
  const { shopId: opaqueShopId, cartId: opaqueCartId } = args;

  const shopId = decodeShopOpaqueId(opaqueShopId);
  const cartId = decodeCartOpaqueId(opaqueCartId);

  return context.queries.discountsFromCart(context, { cartId, shopId });
}
