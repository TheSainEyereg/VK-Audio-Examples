import assert from "node:assert";
import crypto from "node:crypto";
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";

export const extractMp3 = async (url) => {
	assert(url, "URL is required");
	
	const lines = await fetch(url)
		.then(r => r.text())
		.then(s => s.split("\n"));
	
	const pubKeyUrl = lines
		.find(l => l.startsWith("#EXT-X-KEY"))
		?.split("\"")
		?.find(k => k.startsWith("https"));
	
	assert(pubKeyUrl, "Could not find key url");
	
	const pubKey = await fetch(pubKeyUrl)
		.then(r => r.arrayBuffer())
		.then(a => Buffer.from(a));
	
	const [ base ] = url.split("index.m3u8");
	
	let buffer = Buffer.alloc(0);
	
	let encryptionEnabled = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
	
		if (line.startsWith("#EXT-X-KEY"))
			encryptionEnabled = line.includes("AES-128");
	
		if (line.startsWith("seg-")) {
			let ts = await fetch(base + line)
				.then(r => r.arrayBuffer())
				.then(a => Buffer.from(a));
	
			if (encryptionEnabled) {
				const iv = ts.subarray(0, 16);
				const data = ts.subarray(16);
				const key = crypto.createDecipheriv("aes-128-cbc", pubKey, iv);
				ts = Buffer.concat([key.update(data), key.final()]);
			}
	
			buffer = Buffer.concat([buffer, ts]);
		}
	}

	return execa(ffmpegPath, ["-i", "-", "-f", "mp3", "pipe:1"], { input: buffer })
		.stdout;
}