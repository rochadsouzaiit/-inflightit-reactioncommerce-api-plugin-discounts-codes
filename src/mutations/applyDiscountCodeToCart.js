import SimpleSchema from "simpl-schema";
import Random from "@reactioncommerce/random";
import ReactionError from "@reactioncommerce/reaction-error";
import getCart from "../util/getCart.js";
import isShopCountyValidForDiscount from "../util/isShopCountyValidForDiscount.js";

const inputSchema = new SimpleSchema({
  cartId: String,
  discountCode: String,
  shopId: String,
  token: {
    type: String,
    optional: true
  }
});

/**
 * @method applyDiscountCodeToCart
 * @summary Applies a discount code to a cart
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - an object of all mutation arguments that were sent by the client
 * @param {Object} input.cartId - Cart to add discount to
 * @param {Object} input.discountCode - Discount code to add to cart
 * @param {String} input.shopId - Shop cart belongs to
 * @param {String} [input.token] - Cart token, if anonymous
 * @returns {Promise<Object>} An object with the updated cart with the applied discount
 */
export default async function applyDiscountCodeToCart(context, input) {
  inputSchema.validate(input);

  const { cartId, shopId, token } = input;
  const { collections, userId } = context;
  const { Cart, Discounts, Shops, AppSettings, users } = collections;

  // Force code to be lower case
  const discountCode = input.discountCode.toLowerCase();

  let userCount = 0;
  let orderCount = 0;
  let cart = await getCart(context, shopId, cartId, {
    cartToken: token,
    throwIfNotFound: false
  });

  const primaryShop = await Shops.findOne({ shopType: "primary" });
  const shopSettings = await AppSettings.findOne({ shopId });

  // If we didn't find a cart, it means it belongs to another user,
  // not the currently logged in user.
  // Check to make sure current user has admin permission.
  if (!cart) {
    cart = await Cart.findOne({ _id: cartId });
    if (!cart) {
      throw new ReactionError("not-found", "Cart not found");
    }

    await context.validatePermissions(
      `reaction:legacy:carts:${cartId}`,
      "update",
      {
        shopId,
        owner: cart.accountId
      }
    );
  }

  // Checks if user exist.
  const user = await users.findOne({ _id: userId });
  if (!user) {
    throw new ReactionError(
      "not-found",
      "SERVER.ECOMMERCE.GENERAL.USER_DOES_NOT_EXIST"
    );
  }

  const objectToApplyDiscount = cart;

  const discount = await Discounts.findOne({
    code: discountCode,
    shopId: { $in: [primaryShop._id, shopId] }
  });
  if (!discount) {
    throw new ReactionError(
      "not-found",
      "SERVER.ECOMMERCE.GENERAL.DISCOUNT_DOES_NOT_EXIST"
    );
  }

  const { conditions } = discount;
  let notAdherentStores = false;
  let accountLimitExceeded = false;
  let discountLimitExceeded = false;
  let discountDisabled = false;
  let discountOutdated = false;
  let discountOutOfMinAndMaxBoundaries = false;
  let notValidCounty = false;

  // existing usage count
  if (discount.transactions) {
    const users_ = Array.from(discount.transactions, (trans) => trans.userId);
    const transactionCount = new Map([...new Set(users_)].map((userX) => [
      userX,
      users_.filter((userY) => userY === userX).length
    ]));
    const orders = Array.from(discount.transactions, (trans) => trans.cartId);
    userCount = transactionCount.get(userId);
    orderCount = orders.length;
  }

  const cartsWithDiscount = await Cart.find({
    "accountId": userId,
    "billing.paymentPluginName": "discount-codes",
    "billing.data.discountId": discount._id
  }).toArray();
  const cartsCount = cartsWithDiscount.length;
  // check limits
  if (conditions) {
    const {
      enabled,
      order,
      county,
      accountLimit,
      redemptionLimit,
      permissions
    } = conditions;

    discountDisabled = !enabled;

    if (order) {
      if (order.endDate) {
        discountOutdated = new Date(order.endDate) < new Date();
      }

      if (order.min || order.max) {
        const cartTotal =
          (cart.items || []).reduce(
            (acc, currentItem) => acc + currentItem.subtotal.amount,
            0
          ) - (cart.discount || 0);
        discountOutOfMinAndMaxBoundaries =
          cartTotal < (order.min || 0) ||
          cartTotal > (order.max || Number.POSITIVE_INFINITY);
      }
    }

    if (county) {
      notValidCounty = !(await isShopCountyValidForDiscount(
        shopSettings,
        county
      ));
    }

    if (accountLimit) {
      accountLimitExceeded =
        accountLimit <= userCount || accountLimit <= cartsCount;
    }

    if (redemptionLimit) {
      discountLimitExceeded = redemptionLimit <= orderCount;
    }

    // // TODO: "CONVERSE" This is an hammer. If shop ID is in permissions then it is not an adherent store.
    if (permissions) notAdherentStores = permissions.includes(shopId);
  }

  if (notAdherentStores) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.NOT_ADHERENT_STORE"
    );
  }
  if (notValidCounty) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.NOT_VALID_COUNTY"
    );
  }
  if (discountOutOfMinAndMaxBoundaries) {
    const { min, max } = conditions.order;
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.AMOUNT_OUT_OF_BOUNDS",
      { min, max }
    );
  }
  if (discountLimitExceeded) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.DISCOUNT_LIMIT_EXCEEDED"
    );
  }
  if (accountLimitExceeded) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.USER_LIMIT_EXCEEDED"
    );
  }
  if (discountDisabled) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.DISABLED"
    );
  }
  if (discountOutdated) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.OUTDATED"
    );
  }

  if (!cart.billing) {
    cart.billing = [];
  }

  cart.billing.push({
    _id: Random.id(),
    amount: discount.discount,
    createdAt: new Date(),
    currencyCode: objectToApplyDiscount.currencyCode,
    data: {
      discountId: discount._id,
      code: discount.code
    },
    displayName: `Discount Code: ${discount.code}`,
    method: discount.calculation.method,
    mode: "discount",
    name: "discount_code",
    paymentPluginName: "discount-codes",
    processor: discount.discountMethod,
    shopId: objectToApplyDiscount.shopId,
    status: "created",
    transactionId: Random.id()
  });

  // Instead of directly updating cart, we add the discount billing
  // object from the existing cart, then pass to `saveCart`
  // to re-run cart through all transforms and validations.
  const savedCart = await context.mutations.saveCart(context, cart);

  return savedCart;
}
