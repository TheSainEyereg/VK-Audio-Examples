import { exit, stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { writeFile, readFile, rm } from "node:fs/promises";

import { VK } from "vk-io";

const rl = readline.createInterface({ input, output });

const auth = async () => {
	console.log("Visit https://oauth.vk.com/authorize?client_id=6121396&scope=1073737727&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token&revoke=1 and copy redirect url here");
	const answer = await rl.question("Paste URL here: ");

	const queryPairs = answer.split("#").pop()
		?.split("&").map(qp => qp.split("=")).map(([k, v]) => ([k, isNaN(v) ? v : Number(v)]))
		?? [];
	
	const { user_id: id, access_token: token, expires_in: expires } = Object.fromEntries(queryPairs);

	return { id, token, expires };
}

const { id, token, expires } = await readFile("./token")
	.then(s => s.toString().split("\r\n"))
	.then(a => ({ id: Number(a[0]), token: a[1], expires: Number(a[2]) }))
	.catch(() => null) || await auth();

const creds = [id, token, expires].filter(el => ["string", "number"].includes(typeof el));

await writeFile("./token", creds.join("\r\n"));

if (creds.length !== 3 || expires !== 0 && expires * 1000 < Date.now()) {
	console.log(creds.length !== 3 ? "Wrong url: no auth credentials" : "Token expired: relaunch script and paste url again");

	await rm("./token");

	exit();
}

console.log(`Token ${expires === 0 ? "never expires" : `expires at ${new Date(expires * 1000).toLocaleString()}`}`);

const { api } = new VK({
	token,
	apiHeaders: { "User-Agent": "VKAndroidApp/7.33-13214" },
});

export const getSection = async (section_id, data_type, start_from) => {
	console.log(start_from ? `Next section (${data_type}): ${start_from}` : `Section (${data_type}): ${section_id}`);

	const section = await api.call("catalog.getSection", {section_id, start_from});
	const next = section.section.blocks.find(b => b.data_type === data_type);

	if (!next)
		return [];

	if (next.id !== section_id)
		return await getSection(next.id, data_type);

	return next.next_from ? [...section.audios, ...await getSection(next.id, next.data_type, next.next_from)] : section.audios;
}

export const getOwnerAudios = async () => {
	const sections = await api.call("catalog.getAudio", { owner_id: id });
	return await getSection(sections.catalog.default_section, "music_audios");
}

export const getAudios = (audios) => 
	api.call("audio.getById", { audios });

export const getPlaylistAudios = async (owner_id, playlist_id) => {
	const { audio_ids } = await api.call("audio.getPlaylistById", { owner_id, playlist_id, extra_fields: "audio_ids" });
	return await getAudios(audio_ids.map(a => a.audio_id));
}

export const searchAudios = async (q, count, offset) => {
	const { items } = await api.call("audio.search", { q, count, offset });
	return await getAudios(items.map(a => `${a.owner_id}_${a.id}`));
}