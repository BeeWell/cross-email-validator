/*global fetch*/

const {isUndefined, isNil, isEmpty, isString, assign} = require("lodash");
const looksLikeEmail = require("validator/lib/isEmail");
const Promise = require("bluebird");
const URI = require("urijs");
const tlds = require("tlds");

// Ensure we have 'fetch' (eg: in Node)
if(isUndefined(global.fetch)) {
  require("cross-fetch/polyfill"); // Lets us test the file in Node
}

const atSymbol = "@";
const getDnsOverHttpUri = (
  (baseUri) => (domainName) => baseUri.clone().setQuery({name: domainName}).toString()
)(new URI("https://cloudflare-dns.com/dns-query").setQuery({
  "type": "MX",
  "do": true,
  "cd": false,
}));
const getBurnerCheckUri = (domainName) => new URI("https://open.kickbox.com/v1/disposable/beewell.health").filename(domainName).toString();

const doFetch = (uri, customOptions={}) => Promise.try(() => fetch(uri, assign({
  credentials: "omit",
  mode: "cors",
  method: "GET",
}, customOptions))).tap((response) => {
  if(!response.ok) {
    console.warn("Could not perform fetch: response was not ok", {response, uri, customOptions});
    throw new Error(`Network error while fetching: ${uri}`);
  }
}).call("json");


module.exports = (addr) => {
  const onError = (msg) => (error) => {
    console.warn(`Error while ${msg}; returning true by default: ${error.message}`, {addr, error}, error);
    return true;
  };
  const logResults = (msg) => (result) => console.debug(
    `Results of ${msg}`, {addr, result}
  );

  const timeLimitMs = 5000;

  const runCheck = (msg, func) => Promise.try(() => func(addr)).timeout(timeLimitMs).tap(
    (result) => console.debug(`Successfully completed ${msg}.`, result)
  ).catch(onError(msg)).tap(logResults(msg));

  const validatingName = "validating email address";
  return runCheck(validatingName, () => {

    // Basic sanity checks.
    if(isNil(addr)) return false;
    if(!(isString(addr))) return false;
    if(isEmpty(addr.trim())) return false;

    // Ensure that '@' is not the first or last char.
    if(addr.startsWith(atSymbol)) return false;
    if(addr.endsWith(atSymbol)) return false;

    // Now split to get the username and domain name
    const [username, domainName, ...addrExtra] = addr.split(atSymbol);
    if(!(isNil(addrExtra) || isEmpty(addrExtra))) return false;
    if(isNil(username) || isNil(domainName)) return false;
    if(isEmpty(username.trim()) || isEmpty(domainName.trim())) return false;

    // Now check that it's sane: valid TLD and looks like an e-mail as per Validator
    if(!tlds.includes(domainName.split(".").pop())) return false;
    if(!looksLikeEmail(addr)) return false;

    // Construct the checks.
    const mxRecordCheckName = "performing the MX record DNS check";
    const mxRecordCheck = runCheck(
      mxRecordCheckName,
      () => doFetch(
        getDnsOverHttpUri(domainName),
        {headers: {accept: "application/dns-json"}}
      ).tap((result) => {
        if(result.Status !== 0) {
          throw new Error(`Bad status code from DNS query: ${result.Status}`);
        }
      }).then(
        (it) => it.Answer
      ).then(
        (answer) => !(isNil(answer) || isEmpty(answer))
      )
    );

    const burnerName = "performing burner e-mail check";
    const burnerCheck = runCheck(
      burnerName,
      () => doFetch(getBurnerCheckUri(domainName)).then((it) => Boolean(it.disposable)).then((result) => {
        if(isNil(result)) {
          throw new Error(`No result returned: ${result}`);
        }
        return !result;
      })
    );

    const compilingName = "compiling results";
    return runCheck(compilingName, () => Promise.filter([mxRecordCheck,burnerCheck], (it) => !it).then((failures) => isNil(failures) || isEmpty(failures)));
  });
};
