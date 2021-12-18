/** @param {NS} ns **/
export async function main(ns) {
  const target = ns.args[0];
  const host = ns.getHostname();
  const hacktime = ns.getHackTime(target);
  const weakentime = hacktime * 4;
  const growtime = hacktime * 3.2;

  const free = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
  const ramCost = 1.7 + 1.75 * 2 + 1.75 * 15;

  const possibleBatches = Math.floor(free / ramCost);
  const speed = possibleBatches / (weakentime / 1000);

  const growdelay = weakentime - growtime;
  const hackdelay = weakentime - hacktime;

  ns.tprint("Attack starts in ", weakentime / 1000, " seconds");
  let current = 0; //Keeps track of time so the timed attack works properly
  while (1) {
    ns.exec("/utils/weaken.ns", host, 2, target, current);
    if (current >= growdelay)
      ns.exec("/utils/grow.ns", host, 15, target, current);
    if (current >= hackdelay)
      ns.exec("/utils/hack.ns", host, 1, target, current);
    await ns.sleep(1000 / speed);
    current += 1000 / speed;
  }
}
