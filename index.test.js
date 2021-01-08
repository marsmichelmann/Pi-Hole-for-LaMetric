const { fetchWithAuth } = require("./index");
const { logIfDebug } = require("./index");
const config = require(`./config.json`);
const { mapToBody } = require("./index");
const { piHoleSummaryData } = require("./index.mockdata");
const { piHoleTopItemsData } = require("./index.mockdata");
const { piHoleRecentBlockedData } = require("./index.mockdata");
const { mapKeyValuePairToString } = require("./index");
const { piHoleErrorResponse } = require("./index.mockdata");
const { piHoleInvalidResponse } = require("./index.mockdata");
const { piHoleTest } = require("./index");
const { piHoleResponse } = require("./index.mockdata");
const { laMetricTest } = require("./index");
const { main } = require("./index");
const { lametricNotFoundErrorResponse } = require("./index.mockdata");
const { lametricUnauthorizedResponse } = require("./index.mockdata");
const { laMetricDeviceInfo } = require("./index.mockdata");
const { laMetricDeviceInfo2 } = require("./index.mockdata");

describe("testing pi hole for lametric", () => {
  beforeEach(() => {
    config.debugMode = true;
    jest.useFakeTimers();
  });

  // // TODO MMI
  // it("should work integatively", async () => {
  //   //fetchMock.doMock();
  //   //fetchMock.mockReject(piHoleErrorResponse);
  //   const spyConsole = jest.spyOn(console, "log").mockImplementation();
  //   const callbackMock = jest.fn(() => {});
  //   const flushPromises = () => new Promise(setImmediate);
  //
  //   main();
  //   //await flushPromises();
  //
  //   //expect(spyConsole).toBeCalledWith(piHoleErrorResponse);
  //   //expect(callbackMock).toBeCalled();
  //   spyConsole.mockRestore();
  //   //fetchMock.dontMock();
  // });

  it("should call catch callback function, when init of pi hole leads to error response", async () => {
    fetchMock.doMock();
    fetchMock.mockReject(piHoleErrorResponse);
    const callbackMock = jest.fn(() => {});
    const flushPromises = () => new Promise(setImmediate);

    piHoleTest().catch(callbackMock);
    await flushPromises();

    expect(callbackMock).toBeCalled();
    fetchMock.dontMock();
  });

  it("should call catch callback function, when init of pi hole leads to unexpected response", async () => {
    fetchMock.doMock();
    fetchMock.mockResponse(JSON.stringify(piHoleInvalidResponse));
    const callbackMock = jest.fn(() => {});
    const flushPromises = () => new Promise(setImmediate);

    piHoleTest().catch(callbackMock);
    await flushPromises();

    expect(callbackMock).toBeCalled();
    fetchMock.dontMock();
  });

  it("should then call callback function, when init of pi hole is successful", async () => {
    fetchMock.doMock();
    fetchMock.mockResponse(JSON.stringify(piHoleResponse));
    const callbackMock = jest.fn(() => {});
    const flushPromises = () => new Promise(setImmediate);

    piHoleTest().then(callbackMock);
    await flushPromises();

    expect(callbackMock).toBeCalled();
    fetchMock.dontMock();
  });

  it("should call catch callback function, when init of lametric leads to error response", async () => {
    fetchMock.doMock();
    fetchMock.mockReject(JSON.stringify(lametricNotFoundErrorResponse));
    const callbackMock = jest.fn(() => {});
    const flushPromises = () => new Promise(setImmediate);

    laMetricTest().catch(callbackMock);
    await flushPromises();

    expect(callbackMock).toBeCalled();
    fetchMock.dontMock();
  });

  it("should call catch callback function, when connection to found lametric is unauthorized", async () => {
    fetchMock.doMock();
    fetchMock.mockResponse(JSON.stringify(lametricUnauthorizedResponse));
    const callbackMock = jest.fn(() => {});
    const flushPromises = () => new Promise(setImmediate);

    laMetricTest().catch(callbackMock);
    await flushPromises();

    expect(callbackMock).toBeCalled();
    fetchMock.dontMock();
  });

  it("should call callback function, when init of lametric is successful", async () => {
    fetchMock.doMock();
    fetchMock.mockResponses(
      [JSON.stringify(laMetricDeviceInfo)],
      [JSON.stringify(laMetricDeviceInfo2)]
    );
    const callbackMock = jest.fn(() => {});
    const flushPromises = () => new Promise(setImmediate);

    laMetricTest().then(callbackMock);
    await flushPromises();

    expect(callbackMock).toBeCalled();
    fetchMock.dontMock();
  });

  // TODO MMI add tests for
  // updateLaMetric
  // startUpdateTimer

  it("should fetch Json Placeholder via fetchWithAuth", () => {
    fetchWithAuth("https://jsonplaceholder.typicode.com/todos/1").then(
      (data) => {
        expect(data.title).toBe("delectus aut autem");
      }
    );
  });

  it("shouldn't log, when debug mode is disabled", () => {
    config.debugMode = false;
    const spyConsole = jest.spyOn(console, "log").mockImplementation();
    logIfDebug("test msg");

    expect(spyConsole).toHaveBeenCalledTimes(0);
    spyConsole.mockRestore();
  });

  it("should log, if debug mode is enabled", () => {
    const spyConsole = jest.spyOn(console, "log").mockImplementation();
    logIfDebug("test msg");

    expect(spyConsole).toHaveBeenCalledTimes(1);
    spyConsole.mockRestore();
  });

  it("should map pi hole data", () => {
    let body = mapToBody(
      piHoleSummaryData,
      piHoleTopItemsData,
      piHoleRecentBlockedData
    );

    expect(body.blockListSize).toBe(piHoleSummaryData.domains_being_blocked);
    expect(body.dnsQueriesToday).toBe(piHoleSummaryData.dns_queries_today);
    expect(body.adsBlockedToday).toBe(piHoleSummaryData.ads_blocked_today);
    expect(body.totalClientsSeen).toBe(piHoleSummaryData.clients_ever_seen);
    expect(body.totalDNSQueries).toBe(piHoleSummaryData.dns_queries_all_types);
    expect(body.topQuery).toBe(
      "data.iot.us-east-1.amazonaws.com (3741 Queries)"
    );
    expect(body.topBlockedQuery).toBe(
      "web.vortex.data.microsoft.com (928 Queries)"
    );
    expect(body.lastBlockedQuery).toBe(piHoleRecentBlockedData);
  });

  it("should map key value pair", () => {
    expect(mapKeyValuePairToString(piHoleTopItemsData.top_queries, 0)).toBe(
      "data.iot.us-east-1.amazonaws.com (3741 Queries)"
    );
    expect(mapKeyValuePairToString(piHoleTopItemsData.top_queries, 1)).toBe(
      "lametric.iderp.io (2854 Queries)"
    );
    expect(mapKeyValuePairToString(piHoleTopItemsData.top_ads, 0)).toBe(
      "web.vortex.data.microsoft.com (928 Queries)"
    );
    expect(mapKeyValuePairToString(piHoleTopItemsData.top_ads, 1)).toBe(
      "ichnaea.netflix.com (647 Queries)"
    );
  });
});
