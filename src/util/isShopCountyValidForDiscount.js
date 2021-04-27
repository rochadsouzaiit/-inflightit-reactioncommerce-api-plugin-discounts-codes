
import axios from "axios";
import ReactionError from "@reactioncommerce/reaction-error";

/**
 * @name discounts/codes/county
 * @method
 * @memberof Discounts/Codes/Methods
 * @summary check if shop county is valid for discount
 * @param {Object} shopSettings shopSettings
 * @param {String} county county
 * @returns {Boolean} returns if shop is valid taking into account the county
 */
export default async function isShopCountyValidForDiscount(shopSettings, county) {
  const { latitude, longitude } = shopSettings || {};

  if (!latitude || !longitude) return false;

  let adminArea2 = null;
  let res;
  try {
    res = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_KEY}`);
    if (res.data.status !== "OK") { throw new Error(); }

    adminArea2 = res.data.results.find((result) => (result.types || []).includes("administrative_area_level_2"));
    if (!adminArea2 || !adminArea2.address_components.length) throw new Error();
  } catch (err) {
    throw new ReactionError(
      "error-occurred",
      "SERVER.ECOMMERCE.DISCOUNTS.ERROR_GETTING_COUNTY_FROM_GOOGLE"
    );
  }

  return adminArea2.address_components[0].long_name.toLowerCase() === county.toLowerCase();
}


