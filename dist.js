const{isUndefined,isNil,isEmpty,isString,merge}=require("lodash"),looksLikeEmail=require("validator/lib/isEmail"),Promise=require("bluebird"),URI=require("urijs"),tlds=require("tlds");isUndefined(global.fetch)&&require("cross-fetch/polyfill");const atSymbol="@",getDnsOverHttpUri=(a=>b=>a.clone().setQuery({name:b}).toString())(new URI("https://cloudflare-dns.com/dns-query").setQuery({type:"MX",do:!0,cd:!1})),getBurnerCheckUri=a=>new URI("https://open.kickbox.com/v1/disposable/beewell.health").filename(a).toString(),doFetch=(a,b={})=>Promise.try(()=>fetch(a,merge({credentials:"omit",mode:"cors",method:"GET"},b))).tap(c=>{if(!c.ok)throw console.warn("Could not perform fetch: response was not ok",{response:c,uri:a,customOptions:b}),new Error(`Network error while fetching: ${a}`)}).call("json");module.exports=a=>{const b=b=>c=>(console.warn(`Error while ${b}; returning true by default: ${c.message}`,{addr:a,error:c},c),!0),c=b=>c=>console.debug(`Results of ${b}`,{addr:a,result:c}),d=(d,e)=>Promise.try(()=>e(a)).timeout(1e3).tap(a=>console.debug(`Successfully completed ${d}.`,a)).catch(b(d)).tap(c(d));return d("validating email address",()=>{if(isNil(a))return!1;if(!isString(a))return!1;if(isEmpty(a.trim()))return!1;if(a.startsWith(atSymbol))return!1;if(a.endsWith(atSymbol))return!1;const[b,c,...e]=a.split(atSymbol);if(!(isNil(e)||isEmpty(e)))return!1;if(isNil(b)||isNil(c))return!1;if(isEmpty(b.trim())||isEmpty(c.trim()))return!1;if(!tlds.includes(c.split(".").pop()))return!1;if(!looksLikeEmail(a))return!1;const f=d("performing the MX record DNS check",()=>doFetch(getDnsOverHttpUri(c),{headers:{accept:"application/dns-json"}}).tap(a=>{if(0!==a.Status)throw new Error(`Bad status code from DNS query: ${a.Status}`)}).then(a=>a.Answer).then(a=>{if(isNil(a))throw new Error(`No answer returned: ${a}`);return!isEmpty(a)})),g=d("performing burner e-mail check",()=>doFetch(getBurnerCheckUri(c)).then(a=>!!a.disposable).then(a=>{if(isNil(a))throw new Error(`No result returned: ${a}`);return!a}));return d("compiling results",()=>Promise.filter([f,g],a=>!a).then(a=>isNil(a)||isEmpty(a)))})};

