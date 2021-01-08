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

let piHoleInvalidResponse = {
  "bla": {
    "A (IPv4)": 57,
    "AAAA (IPv6)": 35.62,
    "ANY": 0,
    "SRV": 0.04,
    "SOA": 0,
    "PTR": 1.01,
    "TXT": 0.03,
    "NAPTR": 0,
    "MX": 0,
    "DS": 0,
    "RRSIG": 0,
    "DNSKEY": 0,
    "OTHER": 6.3
  }
};

let piHoleResponse = {
  "querytypes": {
    "A (IPv4)": 11111,
    "AAAA (IPv6)": 38.46,
    "ANY": 0,
    "SRV": 0.03,
    "SOA": 0.01,
    "PTR": 1.07,
    "TXT": 0.03,
    "NAPTR": 0,
    "MX": 0,
    "DS": 0,
    "RRSIG": 0,
    "DNSKEY": 0,
    "OTHER": 5.89
  }
};

let piHoleErrorResponse = {
  "message": "request to http://localhost/admin/api.php?getQueryTypes&auth=7f47df1359d0453d67b647e24e1c88666d3e8ff7ffd9972fc8ae99923e5f7ac5 failed, reason: connect ECONNREFUSED 127.0.0.1:80",
  "type": "system",
  "errno": "ECONNREFUSED",
  "code": "ECONNREFUSED"
};

let lametricNotFoundErrorResponse = {
  "message": "request to http://127.0.0.1:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d failed, reason: connect ECONNREFUSED 127.0.0.1:8080",
  "type": "system",
  "errno": "ECONNREFUSED",
  "code": "ECONNREFUSED"
};

let lametricUnauthorizedResponse = {
  "errors": [
    {
      "message": "Authorization is required"
    }
  ]
};

let laMetricDeviceInfo = {
  "package": "com.lametric.58091f88c1c019c8266ccb2ea82e311d",
  "title": "Pi-Hole Status",
  "triggers": {},
  "vendor": "iDerp",
  "version": "5",
  "version_code": "5",
  "widgets": {
    "bf1a5601a1b54f05ae735183b35dc9e8": {
      "index": -1,
      "package": "com.lametric.58091f88c1c019c8266ccb2ea82e311d"
    }
  }
};

let laMetricDeviceInfo2 = {
  "audio": {
    "volume": 53,
    "volume_limit": {
      "max": 69,
      "min": 0
    },
    "volume_range": {
      "max": 100,
      "min": 0
    }
  },
  "bluetooth": {
    "active": false,
    "address": "A0:2C:36:83:3A:B1",
    "available": true,
    "discoverable": true,
    "low_energy": {
      "active": true,
      "advertising": true,
      "connectable": true
    },
    "name": "LM8525",
    "pairable": true
  },
  "display": {
    "brightness": 75,
    "brightness_limit": {
      "max": 75,
      "min": 2
    },
    "brightness_mode": "auto",
    "brightness_range": {
      "max": 100,
      "min": 0
    },
    "height": 8,
    "screensaver": {
      "enabled": true,
      "modes": {
        "time_based": {
          "enabled": false
        },
        "when_dark": {
          "enabled": true
        }
      },
      "widget": "08b8eac21074f8f7e5a29f2855ba8060"
    },
    "type": "mixed",
    "width": 37
  },
  "id": "13233",
  "mode": "manual",
  "model": "LM 37X8",
  "name": "My LaMetric",
  "os_version": "2.1.2",
  "serial_number": "SA170100852500W00BS9",
  "wifi": {
    "active": true,
    "address": "A0:2C:36:83:13:A1",
    "available": true,
    "encryption": "WPA",
    "essid": "FRITZ!Box7580",
    "ip": "192.168.2.35",
    "mode": "dhcp",
    "netmask": "255.255.255.0",
    "strength": 98
  }
}

module.exports = {
  piHoleSummaryData,
  piHoleTopItemsData,
  piHoleRecentBlockedData,
  piHoleInvalidResponse,
  piHoleErrorResponse,
  piHoleResponse,
  laMetricDeviceInfo,
  laMetricDeviceInfo2,
  lametricNotFoundErrorResponse,
  lametricUnauthorizedResponse,
};
