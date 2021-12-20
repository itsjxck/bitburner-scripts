/// <reference path="./Bitburner.t.ts" />
/** @typedef { import("Bitburner").BitBurner } NS */

import { setTimeout } from "timers/promises";

/** @type NS */
let ns = null;

const SECURITY_MULTIPLIERS = {
  weaken: 0.05,
  grow: 0.004,
  hack: 0.002,
};

const scriptFiles = {
  grow: "/leaching/grow.js",
  weaken: "/leaching/weaken.js",
  hack: "/leaching/hack.js",
};

let hackAmountMultiplier = null;
let target = null;
let targetMinSecurity = null;
let targetMaxMoney = null;

const printGenericInfo = (hackTime, weakenTime, growTime) => {
  ns.print(`****** ${target} ******`);
  ns.print(
    `Available Money: ${ns.nFormat(
      ns.getServerMoneyAvailable(target),
      "($0.00 a)"
    )}`
  );
  ns.print(`Money target: ${ns.nFormat(targetMaxMoney, "($ 0.00 a)")}`);
  ns.print(
    `Current Security Level: ${ns.nFormat(
      ns.getServerSecurityLevel(target),
      "0,0.00"
    )}`
  );
  ns.print(
    `Minimum security level: ${ns.nFormat(targetMinSecurity, "0,0.00")}`
  );
  ns.print(
    `Hack Success Chance: ${ns.nFormat(ns.hackAnalyzeChance(target), "0.00%")}`
  );
  ns.print(`Hack time: ${ns.nFormat(hackTime / 1000, "00:00:00")}`);
  ns.print(`Grow time: ${ns.nFormat(growTime / 1000, "00:00:00")}`);
  ns.print(`Weaken time: ${ns.nFormat(weakenTime / 1000, "00:00:00")}`);
  ns.print(`****** ${target} ******`);
};

const sleep = async (millis) => setTimeout(millis, true);

const scan = (parent, host, list) => {
  const children = ns.scan(host, true);
  for (const child of children) {
    if (parent === child) continue;
    list.push(child);
    scan(host, child, list);
  }
};

const listServers = () => {
  const list = [];
  scan("", ns.getHostname(), list);
  return list;
};

const listAvailableServers = () =>
  listServers().filter((s) => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);

const waitForCycleToFinish = async () => {
  while (true) {
    const isRunning = listAvailableServers().map((s) =>
      ns.isRunning(scriptFiles.weaken, s, target)
    );
    if (!isRunning.includes(true)) return;
    await sleep(500);
  }
};

const getAvailableRam = (s) => ns.getServerMaxRam(s) - ns.getServerUsedRam(s);

const getAvailableThreads = (s, ramCost = 1.75) =>
  Math.floor(getAvailableRam(s) / ramCost);

const getAllAvailableThreads = (ramCost = 1.75) =>
  listAvailableServers()
    .map((s) => getAvailableThreads(s, ramCost))
    .reduce((a, b) => a + b, 0);

const getThreadsToMaxMoney = (available = ns.getServerMoneyAvailable(target)) =>
  Math.ceil(
    ns.growthAnalyze(target, 1 + (targetMaxMoney - available) / available)
  );

const getThreadsToMinSecurity = () =>
  Math.ceil(
    (ns.getServerSecurityLevel(target) - targetMinSecurity) /
      SECURITY_MULTIPLIERS.weaken
  );

const getThreadsForHack = () =>
  Math.ceil(
    ns.hackAnalyzeThreads(target, targetMaxMoney * hackAmountMultiplier)
  );

const primeServer = async () => {
  const hackTime = ns.getHackTime(target);
  const weakenTime = hackTime * 4;
  const growTime = hackTime * 3.2;
  printGenericInfo(hackTime, weakenTime, growTime);

  const growThreadsNeeded = getThreadsToMaxMoney();
  const growSecIncrease = growThreadsNeeded * SECURITY_MULTIPLIERS.grow;
  const weakenThreadsNeeded =
    getThreadsToMinSecurity() +
    Math.ceil(growSecIncrease / SECURITY_MULTIPLIERS.weaken);
  const totalThreadsNeeded = growThreadsNeeded + weakenThreadsNeeded;
  if (totalThreadsNeeded < 10) return;

  let growThreadsStarted = 0;
  let weakenThreadsStarted = 0;
  while (growThreadsStarted + weakenThreadsStarted < totalThreadsNeeded) {
    for (const server of listAvailableServers()) {
      let threads = getAvailableThreads(server);

      if (growThreadsStarted < growThreadsNeeded) {
        let growThreads = threads;
        if (growThreadsStarted + threads > growThreadsNeeded)
          growThreads = growThreadsNeeded - growThreadsStarted;
        if (threads === 0) continue;
        try {
          ns.exec(scriptFiles.grow, server, threads, target);
        } catch (e) {
          continue;
        }
        growThreadsStarted += growThreads;
        threads -= growThreads;
      }

      if (weakenThreadsStarted + threads > weakenThreadsNeeded)
        threads = weakenThreadsNeeded - weakenThreadsStarted;
      if (threads === 0) continue;
      try {
        ns.exec(scriptFiles.weaken, server, threads, target);
      } catch (e) {
        continue;
      }
      weakenThreadsStarted += threads;
    }
  }
  ns.print(`[Priming] ${growThreadsStarted} grow threads`);
  ns.print(`[Priming] ${weakenThreadsStarted} weaken threads`);
  await waitForCycleToFinish();
  ns.print(`[Priming]: Complete`);
};

const batchAttack = async () => {
  const hackTime = ns.getHackTime(target);
  const weakenTime = hackTime * 4;
  const growTime = hackTime * 3.2;
  printGenericInfo(hackTime, weakenTime, growTime);

  const hackThreadsNeeded = getThreadsForHack();
  const hackMaxSteal =
    targetMaxMoney * (ns.hackAnalyze(target) * hackThreadsNeeded);

  ns.print(`Max steal: ${ns.nFormat(hackMaxSteal, "($0.00 a)")}`);
  ns.print(`Grow threads from available: ${getThreadsToMaxMoney()}`);
  ns.print(
    `Grow threads to counter hack: ${getThreadsToMaxMoney(
      targetMaxMoney - hackMaxSteal
    )}`
  );

  const growThreadsNeeded =
    getThreadsToMaxMoney() +
    getThreadsToMaxMoney(targetMaxMoney - hackMaxSteal);
  const securityIncrease =
    hackThreadsNeeded * SECURITY_MULTIPLIERS.hack +
    growThreadsNeeded * SECURITY_MULTIPLIERS.grow;

  const weakenThreadsToCounter = Math.ceil(
    securityIncrease / SECURITY_MULTIPLIERS.weaken
  );

  ns.print(`Weaken threads from current: ${getThreadsToMinSecurity()}`);
  ns.print(`Weaken threads to counter: ${weakenThreadsToCounter}`);

  const weakenThreadsNeeded =
    getThreadsToMinSecurity() + weakenThreadsToCounter;
  const totalThreadsNeeded = growThreadsNeeded + weakenThreadsNeeded;
  const batches = Math.floor(getAllAvailableThreads() / totalThreadsNeeded);
  ns.print(`BATCHES: ${batches}`);

  let hackThreadsStarted = 0;
  let growThreadsStarted = 0;
  let weakenThreadsStarted = 0;
  while (
    hackThreadsStarted + growThreadsStarted + weakenThreadsStarted <
    totalThreadsNeeded
  ) {
    for (const server of listAvailableServers()) {
      if (hackThreadsStarted < hackThreadsNeeded) {
        let threads = getAvailableThreads(server, 1.7);
        if (hackThreadsStarted + threads > hackThreadsNeeded)
          threads = hackThreadsNeeded - hackThreadsStarted;
        if (threads === 0) continue;
        try {
          ns.exec(scriptFiles.hack, server, threads, target);
        } catch (e) {
          continue;
        }
        hackThreadsStarted += threads;
      }

      let threads = getAvailableThreads(server);
      if (threads === 0) continue;

      if (growThreadsStarted < growThreadsNeeded) {
        let growThreads = threads;
        if (growThreadsStarted + growThreads > growThreadsNeeded)
          growThreads = growThreadsNeeded - growThreadsStarted;
        try {
          ns.exec(scriptFiles.grow, server, growThreads, target);
        } catch (e) {
          continue;
        }
        growThreadsStarted += growThreads;
        threads -= growThreads;
      }

      if (weakenThreadsStarted + threads > weakenThreadsNeeded)
        threads = weakenThreadsNeeded - weakenThreadsStarted;
      try {
        ns.exec(scriptFiles.weaken, server, threads, target);
      } catch (e) {
        continue;
      }
      weakenThreadsStarted += threads;
    }
  }
  ns.print(`[Hacking] ${hackThreadsStarted} hack threads`);
  ns.print(`[Hacking] ${growThreadsStarted} grow threads`);
  ns.print(`[Hacking] ${weakenThreadsStarted} weaken threads`);
  await waitForCycleToFinish();
  ns.print(`[Hacking]: Complete`);
};

/** @param { NS } _ns  */
export async function main(_ns) {
  ns = _ns;

  ns.disableLog("ALL");
  // ns.enableLog("exec");

  target = ns.args[0];
  hackAmountMultiplier = ns.args[1] ?? 0.25;

  if (!target) throw new Error("No target");

  targetMinSecurity = ns.getServerMinSecurityLevel(target);
  targetMaxMoney = ns.getServerMaxMoney(target);

  await ns.scp(Object.values(scriptFiles), target);

  await primeServer();

  while (true) {
    await batchAttack();
  }
}
