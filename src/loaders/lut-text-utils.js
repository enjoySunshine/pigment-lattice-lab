/**
 * Low-level, zero-allocation text scanning helpers for LUT file parsers.
 *
 * Numeric tokens are parsed directly into typed arrays to avoid intermediate string
 * allocations, which keeps parsing time predictable for large LUT files.
 *
 * @private
 */

/**
 * Advances the position past whitespace characters.
 *
 * @param {String} input - The text to scan.
 * @param {Number} p - The start index.
 * @param {Number} end - The exclusive end index.
 * @return {Number} The index of the next non-whitespace character.
 */

export function skipToToken(input, p, end) {

	while(p < end) {

		const c = input.charCodeAt(p);

		if(c > 32) {

			break;

		}

		++p;

	}

	return p;

}

/**
 * Reads a decimal float and writes it into the given array.
 *
 * Supports an optional sign, a decimal point and scientific notation.
 *
 * @param {String} input - The text to scan.
 * @param {Number} p - The start index.
 * @param {Number} end - The exclusive end index.
 * @param {TypedArray} out - The destination array.
 * @param {Number} outIndex - The destination index.
 * @return {Number} The index after the parsed number.
 */

export function writeNumber(input, p, end, out, outIndex) {

	let value = 0.0;
	let c = input.charCodeAt(p);
	const negative = (c === 45 /* - */);

	if(negative || c === 43 /* + */) {

		++p;

	}

	while(p < end) {

		c = input.charCodeAt(p);

		if(c < 48 || c > 57) {

			break;

		}

		value = value * 10.0 + (c - 48);
		++p;

	}

	if(c === 46 /* . */) {

		++p;
		let factor = 0.1;

		while(p < end) {

			c = input.charCodeAt(p);

			if(c < 48 || c > 57) {

				break;

			}

			value += (c - 48) * factor;
			factor *= 0.1;
			++p;

		}

	}

	if(c === 101 /* e */ || c === 69 /* E */) {

		++p;
		let expSign = 1;
		const ec = input.charCodeAt(p);

		if(ec === 45 || ec === 43) {

			expSign = (ec === 45) ? -1 : 1;
			++p;

		}

		let exponent = 0;

		while(p < end) {

			c = input.charCodeAt(p);

			if(c < 48 || c > 57) {

				break;

			}

			exponent = exponent * 10 + (c - 48);
			++p;

		}

		value *= 10 ** (expSign * exponent);

	}

	out[outIndex] = negative ? -value : value;
	return p;

}

/**
 * Indicates whether a character starts a numeric token.
 *
 * @param {Number} c - A character code.
 * @return {Boolean} True if the character may start a number.
 */

export function isNumberStart(c) {

	return (c >= 48 && c <= 57) || c === 45 /* - */ || c === 43 /* + */ || c === 46;

}
