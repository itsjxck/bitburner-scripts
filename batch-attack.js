/// <reference path="./Bitburner.t.ts" />
/** @typedef { import("Bitburner").BitBurner } NS */
/** @type NS */
let ns = null;

const SECURITY_MULTIPLIERS = {
  weaken: 0.05,
  grow: 0.004,
  hack: 0.002,
};

const hackAmountMultiplier = 0.1;

const scriptFiles = {
  grow: "/leaching/grow.js",
  weaken: "/leaching/weaken.js",
  hack: "/leaching/hack.js",
};

let target = null;
let targetMinSecurity = null;
let targetMaxMoney = null;
let hackTime = null;
let weakenTime = null;
let growTime = null;

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

const printGenericInfo = () => {
  ns.print(`****** ${target} ******`);
  ns.print(
    `Available Money: ${ns.nFormat(
      ns.getServerMoneyAvailable(target),
      "($0.00 a)"
    )}`
  );
  ns.print(`Money target: ${ns.nFormat(targetMaxMoney, "($ 0.00 a)")}`);
  ns.print(`Grow time: ${ns.nFormat(growTime / 1000, "00:00:00")}`);
  ns.print(
    `Current Security Level: ${ns.nFormat(
      ns.getServerSecurityLevel(target),
      "0,0.00"
    )}`
  );
  ns.print(
    `Security Level Threshold: ${ns.nFormat(targetMinSecurity, "0,0.00")}`
  );
  ns.print(`Weaken time: ${ns.nFormat(weakenTime / 1000, "00:00:00")}`);
  ns.print(
    `Hack Success Chance: ${ns.nFormat(ns.hackAnalyzeChance(target), "0.00%")}`
  );
  ns.print(`Hack time: ${ns.nFormat(hackTime / 1000, "00:00:00")}`);
  ns.print(`****** ${target} ******`);
};

const listAvailableServers = () =>
  listServers().filter((s) => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);

const getAvailableRam = (s) => ns.getServerMaxRam(s) - ns.getServerUsedRam(s);

const getAvailableThreads = (s, ramCost = 1.75) =>
  Math.ceil(getAvailableRam(s) / ramCost);

const getAllAvailableThreads = (ramCost = 1.75) =>
  listAvailableServers()
    .map((s) => getAvailableThreads(s, ramCost))
    .reduce((a, b) => a + b, 0);

const getThreadsToMaxMoney = () => {
  const available = ns.getServerMoneyAvailable(target);
  return ns.growthAnalyze(target, 1 + (targetMaxMoney - available) / available);
};

const getThreadsToMinSecurity = () =>
  Math.ceil(
    (ns.getServerSecurityLevel(target) - targetMinSecurity) *
      SECURITY_MULTIPLIERS.weaken
  );

const getThreadsForTenPercentHack = () =>
  ns.hackAnalyzeThreads(
    target,
    ns.getServerMaxMoney(target) * hackAmountMultiplier
  );

const primeServerWeaken = async () => {
  let threadsStarted = 0;
  const threadsNeeded = getThreadsToMinSecurity();
  if (threadsNeeded === 0) return;
  while (threadsStarted < threadsNeeded) {
    for (const server of listAvailableServers()) {
      let threads = getAvailableThreads(server);
      if (threads === 0) continue;
      if (threads + threadsStarted > threadsNeeded)
        threads = threadsNeeded - threadsStarted;
      ns.exec(scriptFiles.weaken, server, threads, target);
      threadsStarted += threads;
      ns.print(`[${server}] Priming: ${threads} weaken threads`);
    }
  }
  await ns.asleep(weakenTime);
};

const primeServerGrow = async () => {
  const growThreadsNeeded = getThreadsToMaxMoney();
  const growSecIncrease = growThreadsNeeded * SECURITY_MULTIPLIERS.grow;
  const weakenThreadsNeeded = Math.ceil(
    growSecIncrease * SECURITY_MULTIPLIERS.weaken
  );
  const totalThreadsNeeded = growThreadsNeeded + weakenThreadsNeeded;
  if (totalThreadsNeeded === 0) return;

  let growThreadsStarted = 0;
  let weakenThreadsStarted = 0;
  while (growThreadsStarted + weakenThreadsStarted < totalThreadsNeeded) {
    for (const server of listAvailableServers()) {
      let threads = getAvailableThreads(server);
      if (threads === 0) continue;

      if (growThreadsStarted < growThreadsNeeded) {
        let growThreads = threads;
        if (growThreadsStarted + threads > growThreadsNeeded)
          growThreads = growThreadsNeeded - growThreadsStarted;
        ns.exec(scriptFiles.grow, server, threads, target);
        growThreadsStarted += growThreads;
        threads -= growThreads;
        ns.print(`[${server}] Priming: ${growThreads} grow threads`);
      }

      if (weakenThreadsStarted + threads > weakenThreadsNeeded)
        threads = weakenThreadsNeeded - weakenThreadsStarted;
      if (threads === 0) continue;
      ns.exec(scriptFiles.weaken, server, threads, target);
      weakenThreadsStarted += threads;
      ns.print(`[${server}] Priming: ${threads} weaken threads`);
    }
  }
  await ns.asleep(weakenTime);
};

const batchAttack = async () => {
  const hackThreadsNeeded = getThreadsForTenPercentHack();
  const growThreadsNeeded = ns.growthAnalyze(
    target,
    1 +
      (targetMaxMoney - targetMaxMoney * (1 - hackAmountMultiplier)) /
        (targetMaxMoney * (1 - hackAmountMultiplier))
  );
  const securityIncrease =
    hackThreadsNeeded * SECURITY_MULTIPLIERS.hack +
    growThreadsNeeded * SECURITY_MULTIPLIERS.grow;
  const weakenThreadsNeeded = securityIncrease * 0.05;
  const totalThreadsNeeded = growThreadsNeeded + weakenThreadsNeeded;

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
        if (threads === 0) continue;
        if (hackThreadsStarted + threads > hackThreadsNeeded)
          threads = hackThreadsNeeded - hackThreadsStarted;
        ns.exec(scriptFiles.hack, server, threads, target);
        hackThreadsStarted += threads;
        ns.print(`[${server}] Hacking: ${threads} hack threads`);
      }

      let threads = getAvailableThreads(server);
      if (threads === 0) continue;

      if (growThreadsStarted < growThreadsNeeded) {
        let growThreads = threads;
        if (growThreadsStarted + growThreads > growThreadsNeeded)
          growThreads = growThreadsNeeded - growThreadsStarted;
        ns.exec(scriptFiles.grow, server, growThreads, target);
        growThreadsStarted += growThreads;
        threads -= growThreads;
        ns.print(`[${server}] Hacking: ${growThreads} grow threads`);
      }

      if (weakenThreadsStarted + threads > weakenThreadsNeeded)
        threads = weakenThreadsNeeded - weakenThreadsStarted;
      if (threads === 0) continue;
      ns.exec(scriptFiles.weaken, server, threads, target);
      weakenThreadsStarted += threads;
      ns.print(`[${server}] Hacking: ${threads} weaken threads`);
    }
  }
  await ns.asleep(weakenTime);
};

/** @param { NS } _ns  */
export async function main(_ns) {
  ns = _ns;

  ns.disableLog("ALL");

  target = ns.args[0];

  if (!target) throw new Error("No target");

  targetMinSecurity = ns.getServerMinSecurityLevel(target);
  targetMaxMoney = ns.getServerMaxMoney(target);
  hackTime = ns.getHackTime(target);
  weakenTime = hackTime * 4;
  growTime = hackTime * 3.2;

  await ns.scp(Object.values(scriptFiles), target);

  printGenericInfo();
  await primeServerWeaken();
  printGenericInfo();
  await primeServerGrow();
  while (true) {
    printGenericInfo();
    await batchAttack();
  }
}
