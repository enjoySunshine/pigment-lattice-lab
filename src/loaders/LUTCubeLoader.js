import { FileLoader, Loader, LoadingManager, Vector3 } from "three";
import { LookupTexture } from "../textures/lut/LookupTexture.js";
import { isNumberStart, skipToToken, writeNumber } from "./lut-text-utils.js";

/**
 * A 3D LUT loader that supports the .cube file format.
 *
 * Based on an implementation by Garrett Johnson:
 * https://github.com/gkjohnson/threejs-sandbox/tree/master/3d-lut
 *
 * For more details see:
 * https://wwwimages2.adobe.com/content/dam/acom/en/products/speedgrade/cc/pdfs/cube-lut-specification-1.0.pdf
 *
 * @deprecated Use `three/addons/loaders/LUTCubeLoader.js` instead.
 */

export class LUTCubeLoader extends Loader {

	/**
	 * Loads a LUT.
	 *
	 * @param {String} url - The URL of the CUBE-file.
	 * @param {Function} [onLoad] - A callback that receives the loaded lookup texture.
	 * @param {Function} [onProgress] - A progress callback that receives the XMLHttpRequest instance.
	 * @param {Function} [onError] - An error callback that receives the URL of the file that failed to load.
	 */

	load(url, onLoad = () => {}, onProgress = () => {}, onError = null) {

		const externalManager = this.manager;
		const internalManager = new LoadingManager();

		const loader = new FileLoader(internalManager);
		loader.setPath(this.path);
		loader.setResponseType("text");

		loader.load(url, (data) => {

			try {

				const result = this.parse(data);
				externalManager.itemEnd(url);
				onLoad(result);

			} catch(e) {

				internalManager.onError(url);
				onError(e);

			}

		}, onProgress);

	}

	/**
	 * Loads a LUT asynchronously.
	 *
	 * @param {String} url - The URL of the CUBE-file.
	 * @param {Function} [onProgress] - A progress callback that receives the XMLHttpRequest instance.
	 * @return {Promise<LookupTexture>} A promise that returns the lookup texture.
	 */

	loadAsync(url, onProgress = () => {}) {

		const externalManager = this.manager;
		const internalManager = new LoadingManager();

		return new Promise((resolve, reject) => {

			internalManager.onError = (url) => {

				externalManager.itemError(url);
				reject(`Failed to load ${url}`);

			};

			this.load(url, resolve, onProgress);

		});

	}

	/**
	 * Parses the given data.
	 *
	 * The short keyword header is scanned line by line while the data section is read with
	 * a single flat pointer scan. Numeric tokens are parsed directly into the LUT data to
	 * avoid intermediate string allocations.
	 *
	 * @param {String} input - The LUT data.
	 * @return {LookupTexture} The lookup texture.
	 * @throws {Error} Fails if the data is invalid.
	 */

	parse(input) {

		let title = null;
		let size = 0;

		const domainMin = new Vector3(0.0, 0.0, 0.0);
		const domainMax = new Vector3(1.0, 1.0, 1.0);

		const length = input.length;
		const domainTmp = new Float32Array(3);
		let lineStart = 0;

		// Header scan: keyword lines only, stops at the first data line.
		while(lineStart < length) {

			let lineEnd = input.indexOf("\n", lineStart);

			if(lineEnd === -1) {

				lineEnd = length;

			}

			if(lineEnd > lineStart && input.charCodeAt(lineEnd - 1) === 13 /* \r */) {

				--lineEnd;

			}

			const ch = input.charCodeAt(lineStart);

			if(ch === 84 /* T */) {

				const q1 = input.indexOf("\"", lineStart);
				const q2 = input.indexOf("\"", q1 + 1);
				title = input.slice(q1 + 1, q2);

			} else if(ch === 76 /* L */) {

				let e = lineEnd;

				while(e > lineStart && input.charCodeAt(e - 1) <= 32) {

					--e;

				}

				let s = e;

				while(s > lineStart && input.charCodeAt(s - 1) >= 48) {

					--s;

				}

				let n = 0;

				for(let k = s; k < e; ++k) {

					n = n * 10 + (input.charCodeAt(k) - 48);

				}

				size = n;

			} else if(ch === 68 /* D */) {

				const target = (input.charCodeAt(lineStart + 8) === 65 /* A */) ?
					domainMax : domainMin;

				let p = lineStart;

				// Skip the DOMAIN_MIN/MAX keyword.
				while(p < lineEnd && input.charCodeAt(p) > 32) {

					++p;

				}

				p = skipToToken(input, p, lineEnd);
				p = writeNumber(input, p, lineEnd, domainTmp, 0);
				p = skipToToken(input, p, lineEnd);
				p = writeNumber(input, p, lineEnd, domainTmp, 1);
				p = skipToToken(input, p, lineEnd);
				writeNumber(input, p, lineEnd, domainTmp, 2);
				target.set(domainTmp[0], domainTmp[1], domainTmp[2]);

			} else if(size > 0 && isNumberStart(ch)) {

				break;

			}

			lineStart = lineEnd + 1;

		}

		if(size === 0) {

			throw new Error("Missing LUT_3D_SIZE information");

		}

		if(domainMin.x > domainMax.x || domainMin.y > domainMax.y || domainMin.z > domainMax.z) {

			domainMin.set(0.0, 0.0, 0.0);
			domainMax.set(1.0, 1.0, 1.0);

			throw new Error("Invalid input domain");

		}

		const data = new Float32Array(size ** 3 * 4);
		let p = lineStart;
		let i = 0;

		// Flat data scan over whitespace-separated triplets.
		while(p < length) {

			p = skipToToken(input, p, length);

			if(p >= length) {

				break;

			}

			const ch = input.charCodeAt(p);

			if(ch === 35 /* # */) {

				while(p < length && input.charCodeAt(p) !== 10) {

					++p;

				}

			} else if(isNumberStart(ch)) {

				p = writeNumber(input, p, length, data, i++);
				p = skipToToken(input, p, length);
				p = writeNumber(input, p, length, data, i++);
				p = skipToToken(input, p, length);
				p = writeNumber(input, p, length, data, i++);
				data[i++] = 1.0;

			} else {

				// Skip unknown keyword tokens.
				while(p < length && input.charCodeAt(p) > 32) {

					++p;

				}

			}

		}

		const lut = new LookupTexture(data, size);
		lut.domainMin.copy(domainMin);
		lut.domainMax.copy(domainMax);

		if(title !== null) {

			lut.name = title;

		}

		return lut;

	}

}
