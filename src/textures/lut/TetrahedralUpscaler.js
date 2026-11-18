/**
 * A fast tetrahedral upscaler for cubic 3D LUTs.
 *
 * The per-axis base indices and fractional weights are precomputed once, so each output
 * voxel only needs direct index arithmetic, a single tetrahedron test and four weighted
 * texture fetches. Source cell indices are clamped to the source grid which matches the
 * `ClampToEdge` wrapping of lookup textures.
 *
 * Based on an implementation by Garrett Johnson:
 * https://github.com/gkjohnson/threejs-sandbox/blob/master/3d-lut/src/TetrahedralUpscaler.js
 */

export class TetrahedralUpscaler {

	/**
	 * Expands the given data to the target size.
	 *
	 * @param {TypedArray} data - The input RGBA data. Assumed to be cubic.
	 * @param {Number} size - The target size.
	 * @return {TypedArray} The new data.
	 */

	static expand(data, size) {

		const originalSize = Math.round(Math.cbrt(data.length / 4));

		// eslint-disable-next-line new-cap
		const array = new data.constructor(size ** 3 * 4);
		const maxValue = (data instanceof Uint8Array) ? 255 : 1.0;

		const n = originalSize;
		const nSq = n * n;
		const inv = 1.0 / (size - 1.0);
		const sMax = n - 1;

		// Precompute the source cell base index and the fractional weight per axis.
		const lo = new Int32Array(size);
		const fr = new Float64Array(size);

		for(let i = 0; i < size; ++i) {

			const p = i * inv * sMax;
			const base = Math.min(Math.floor(p), n - 2);
			lo[i] = base;
			fr[i] = p - base;

		}

		let o = 0;

		for(let z = 0; z < size; ++z) {

			const bz = lo[z];
			const sz = fr[z];
			const zOff = bz * nSq * 4;
			const zUp = (bz + 1) * nSq * 4;

			for(let y = 0; y < size; ++y) {

				const by = lo[y];
				const sy = fr[y];
				const yOff = by * n * 4;
				const yUp = (by + 1) * n * 4;

				for(let x = 0; x < size; ++x) {

					const bx = lo[x];
					const sx = fr[x];
					const xOff = bx * 4;

					if(sx === 0.0 && sy === 0.0 && sz === 0.0) {

						const i4 = xOff + yOff + zOff;
						array[o++] = data[i4];
						array[o++] = data[i4 + 1];
						array[o++] = data[i4 + 2];
						array[o++] = maxValue;

						continue;

					}

					const i000 = xOff + yOff + zOff;
					const i100 = i000 + 4;
					const i010 = xOff + yUp + zOff;
					const i110 = i010 + 4;
					const i001 = xOff + yOff + zUp;
					const i101 = i001 + 4;
					const i011 = xOff + yUp + zUp;
					const i111 = i011 + 4;

					let ia, ib, ic, id;
					let w0, w1, w2;

					if(sx >= sy) {

						if(sy >= sz) {

							// T0: sx >= sy >= sz
							ia = i000; ib = i100; ic = i110; id = i111;
							w0 = 1.0 - sx; w1 = sx - sy; w2 = sy - sz;

						} else if(sx >= sz) {

							// T1: sx >= sz >= sy
							ia = i000; ib = i100; ic = i101; id = i111;
							w0 = 1.0 - sx; w1 = sx - sz; w2 = sz - sy;

						} else {

							// T2: sz > sx >= sy
							ia = i000; ib = i001; ic = i101; id = i111;
							w0 = 1.0 - sz; w1 = sz - sx; w2 = sx - sy;

						}

					} else {

						if(sz > sy) {

							// T3: sz > sy > sx
							ia = i000; ib = i001; ic = i011; id = i111;
							w0 = 1.0 - sz; w1 = sz - sy; w2 = sy - sx;

						} else if(sx >= sz) {

							// T4: sy > sx >= sz
							ia = i000; ib = i010; ic = i110; id = i111;
							w0 = 1.0 - sy; w1 = sy - sx; w2 = sx - sz;

						} else {

							// T5: sy >= sz > sx
							ia = i000; ib = i010; ic = i011; id = i111;
							w0 = 1.0 - sy; w1 = sy - sz; w2 = sz - sx;

						}

					}

					const w3 = 1.0 - w0 - w1 - w2;

					array[o++] = data[ia] * w0 + data[ib] * w1 +
						data[ic] * w2 + data[id] * w3;
					array[o++] = data[ia + 1] * w0 + data[ib + 1] * w1 +
						data[ic + 1] * w2 + data[id + 1] * w3;
					array[o++] = data[ia + 2] * w0 + data[ib + 2] * w1 +
						data[ic + 2] * w2 + data[id + 2] * w3;
					array[o++] = maxValue;

				}

			}

		}

		return array;

	}

}
