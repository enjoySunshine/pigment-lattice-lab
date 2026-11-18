import { FileLoader, Loader, LoadingManager } from "three";
import { LookupTexture } from "../textures/lut/LookupTexture.js";
import { skipToToken, writeNumber } from "./lut-text-utils.js";

/**
 * A 3D LUT loader that supports the .3dl file format.
 *
 * Based on an implementation by Garrett Johnson:
 * https://github.com/gkjohnson/threejs-sandbox/tree/master/3d-lut
 *
 * For more details see:
 * http://download.autodesk.com/us/systemdocs/help/2011/lustre/index.html?url=./files/WSc4e151a45a3b785a24c3d9a411df9298473-7ffd.htm,topicNumber=d0e9492
 *
 * @deprecated Use `three/addons/loaders/LUT3dlLoader.js` instead.
 */

export class LUT3dlLoader extends Loader {

	/**
	 * Loads a LUT.
	 *
	 * @param {String} url - The URL of the 3dl-file.
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
		externalManager.itemStart(url);

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
	 * Loads a LUT.
	 *
	 * @param {String} url - The URL of the 3dl-file.
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
	 * The grid line and the whitespace-separated data triplets are scanned with a flat
	 * pointer. Numeric tokens are parsed directly into the LUT data to avoid intermediate
	 * string allocations.
	 *
	 * @param {String} input - The LUT data.
	 * @return {LookupTexture} The lookup texture.
	 * @throws {Error} Fails if the data is invalid.
	 */

	parse(input) {

		const length = input.length;
		let p = 0;

		// Skip comment lines.
		while(p < length && input.charCodeAt(p) === 35 /* # */) {

			while(p < length && input.charCodeAt(p) !== 10) {

				++p;

			}

			++p;

		}

		// The first non-comment line describes the positions of values on the LUT grid.
		while(p < length && input.charCodeAt(p) <= 32) {

			if(input.charCodeAt(p) === 10 || input.charCodeAt(p) === 13) {

				break;

			}

			++p;

		}

		const gridLines = [];

		while(p < length) {

			const c = input.charCodeAt(p);

			if(c === 10 || c === 13) {

				break;

			}

			let value = 0;

			while(p < length) {

				const d = input.charCodeAt(p);

				if(d < 48 || d > 57) {

					break;

				}

				value = value * 10 + (d - 48);
				++p;

			}

			gridLines.push(value);

			while(p < length && input.charCodeAt(p) === 32) {

				++p;

			}

		}

		if(gridLines.length === 0) {

			throw new Error("Missing grid information");

		}

		const gridStep = gridLines[1] - gridLines[0];
		const size = gridLines.length;
		const sizeSq = size ** 2;

		for(let i = 1, l = gridLines.length; i < l; ++i) {

			if(gridStep !== (gridLines[i] - gridLines[i - 1])) {

				throw new Error("Inconsistent grid size");

			}

		}

		const data = new Float32Array(size ** 3 * 4);
		const raw = new Float32Array(3);
		let maxValue = 0.0;
		let index = 0;

		while(p < length) {

			p = skipToToken(input, p, length);

			if(p >= length) {

				break;

			}

			if(input.charCodeAt(p) === 35) {

				while(p < length && input.charCodeAt(p) !== 10) {

					++p;

				}

				continue;

			}

			p = writeNumber(input, p, length, raw, 0);
			p = skipToToken(input, p, length);
			p = writeNumber(input, p, length, raw, 1);
			p = skipToToken(input, p, length);
			p = writeNumber(input, p, length, raw, 2);

			const r = raw[0];
			const g = raw[1];
			const b = raw[2];

			if(r > maxValue) { maxValue = r; }
			if(g > maxValue) { maxValue = g; }
			if(b > maxValue) { maxValue = b; }

			const bLayer = index % size;
			const gLayer = Math.floor(index / size) % size;
			const rLayer = Math.floor(index / sizeSq) % size;

			// b grows first, then g, then r.
			const d4 = (bLayer * sizeSq + gLayer * size + rLayer) * 4;
			data[d4 + 0] = r;
			data[d4 + 1] = g;
			data[d4 + 2] = b;
			data[d4 + 3] = 1.0;

			++index;

		}

		// Determine the bit depth and scale the values to [0.0, 1.0].
		const bits = Math.ceil(Math.log2(maxValue));
		const maxBitValue = Math.pow(2, bits);

		for(let i = 0, l = data.length; i < l; i += 4) {

			data[i + 0] /= maxBitValue;
			data[i + 1] /= maxBitValue;
			data[i + 2] /= maxBitValue;

		}

		return new LookupTexture(data, size);

	}

}
