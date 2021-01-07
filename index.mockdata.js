let piHoleSummaryData = {
  domains_being_blocked: "1,399,949",
  dns_queries_today: "47,730",
  ads_blocked_today: "7,558",
  ads_percentage_today: "15.8",
  unique_domains: "2,720",
  queries_forwarded: "22,557",
  queries_cached: "16,896",
  clients_ever_seen: "32",
  unique_clients: "30",
  dns_queries_all_types: "47,730",
  reply_NODATA: "1,556",
  reply_NXDOMAIN: "444",
  reply_CNAME: "3,115",
  reply_IP: "8,212",
  privacy_level: "0",
  status: "enabled",
  gravity_last_updated: {
    file_exists: true,
    absolute: 1609640984,
    relative: {
      days: 4,
      hours: 7,
      minutes: 11,
    },
  },
};

let piHoleTopItemsData = {
  top_queries: {
    "data.iot.us-east-1.amazonaws.com": 3741,
    "lametric.iderp.io": 2854,
    "p.ier.re": 2826,
    "muggli.one": 2532,
    "spectrum.s3.amazonaws.com": 1483,
    "s3.eu-central-1.wasabisys.com": 972,
    "diagnostics.meethue.com": 869,
    "wpad.fritz.box": 784,
    "pool.ntp.org": 664,
    "epdg.epc.mnc002.mcc262.pub.3gppnetwork.org": 580,
  },
  top_ads: {
    "web.vortex.data.microsoft.com": 928,
    "ichnaea.netflix.com": 647,
    "analytics.ff.avast.com": 635,
    "mobile.pipe.aria.microsoft.com": 617,
    "customerevents.netflix.com": 400,
    "app-measurement.com": 238,
    "www.google-analytics.com": 193,
    "www.googletagmanager.com": 165,
    "activity.windows.com": 162,
    "www.googleadservices.com": 143,
  },
};

let piHoleRecentBlockedData = "analytics.ff.avast.com";

// main program END
exports.piHoleSummaryData = piHoleSummaryData;
exports.piHoleTopItemsData = piHoleTopItemsData;
exports.piHoleRecentBlockedData = piHoleRecentBlockedData;
