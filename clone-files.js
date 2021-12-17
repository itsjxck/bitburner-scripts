/** @type NS */
/** @typedef { import("Bitburner").BitBurner } NS */

const apiBase = "https://api.github.com/repos";
const rawBase = "https://raw.githubusercontent.com";
const repo = "itsjxck/bitburner-scripts";

const getCommitSha = async () =>
  (await (await fetch(`${apiBase}/${repo}/branches/main`)).json()).commit.sha;

const getFileList = async () =>
  (
    await (
      await fetch(
        `${apiBase}/${repo}/git/tree/${await getCommitSha()}?recursive=1`
      )
    ).json()
  ).tree.filter((f) => f.type === "blob" && f.path.endsWith(".js"));

/** @param { NS } ns  */
export async function main(ns) {
  const files = await getFileList();
  for (const file of files) {
    await ns.wget(
      `${rawBase}/${repo}/main/${file.path}`,
      `/${repo}/${file.path}`
    );
  }
}
