import { exit, argv } from "node:process";
import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";

import { getPlaylistAudios, getAudios, getOwnerAudios, searchAudios } from "./vk.mjs";
import { extractMp3 } from "./m3u8.mjs";

export const regex = {
	playlist: /^https?:\/\/vk\.(?:com|ru)\/(?:music\/(?:album|playlist)\/|.+z=audio_playlist)(?<id>-?\d+_\d+)/,
	audio: /^https?:\/\/vk\.(?:com|ru)\/audio(?<id>-?\d+_\d+)/
}

const link = argv.slice(2).join(" ");

const playlistId = regex.playlist.exec(link)?.groups?.id;
const audioId = regex.audio.exec(link)?.groups?.id;

let toDownload = [];

if (playlistId) {
	console.log("Album or playlist");
	toDownload = await getPlaylistAudios(...playlistId.split("_").slice(0, 2));
} else if (audioId) {
	console.log("Single track");
	toDownload = await getAudios([ audioId ]);
} else if (link.length > 0) {
	console.log("Search");
	toDownload = await searchAudios(link, 1);
} else {
	console.log("User");
	toDownload = await getOwnerAudios();
}

await mkdir("downloads", { recursive: true });

for (const track of toDownload) {
	const filename = `${track.artist} - ${track.title}.mp3`;

	const out = createWriteStream(join(".", "downloads", filename));
	const stream = await extractMp3(track.url);

	stream.pipe(out);
	await new Promise(res => stream.on("end", res));

	console.log(`Saved \"${filename}\"`);
}

exit();