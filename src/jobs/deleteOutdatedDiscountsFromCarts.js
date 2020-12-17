import deleteOutdatedDiscountsFromCartsFn from "./../util/deleteOutdatedDiscountsFromCarts.js";

const jobType = "discounts/deleteOutdated";

/**
 * @name deleteOutdatedDiscountsFromCarts
 * @summary Initializes and processes a job that removes outdated discounts from carts
 * @param {Object} context App context
 * @returns {undefined}
 */
export default async function deleteOutdatedDiscountsFromCarts(context) {
  await context.backgroundJobs.addWorker({
    type: jobType,
    workTimeout: 180 * 1000,
    async worker(job) {
      try {
        await deleteOutdatedDiscountsFromCartsFn(context);
        job.done(`${jobType} job done`, { repeatId: true });
      } catch (error) {
        console.log(JSON.stringify(error));
        job.fail(`Failed to generate sitemap. Error: ${error}`);
      }
    },
  });
}
