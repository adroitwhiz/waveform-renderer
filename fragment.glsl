precision highp float;

uniform sampler2D u_image0;
uniform vec2 u_textureSize;
uniform float u_numSamples;
uniform vec2 u_canvasSize;
varying vec2 v_texCoord;

// Unpack an RGBA 0-1 float quadruplet (backed by a a 0-255 texture) into a single float.
float unpackPixel (in vec4 rgba) {
	float sgn = rgba.a < 0.5 ? 1.0 : -1.0;
	float expBytes = (mod(rgba.a * 255.0, 128.0) * 2.0) + (rgba.b < 0.5 ? 0.0 : 1.0);

	bool denorm = expBytes == 0.0;
	float exponent = exp2(denorm ? -126.0 : expBytes - 127.0);

	// shave top bit
	float mantissaTop = mod(rgba.b * 255.0, 128.0) / 255.0;

	float mantissa = ((mantissaTop * 65536.0) + (rgba.g * 256.0) + rgba.r) * 255.0;

	float final = sgn * exponent * ((denorm ? 0.0 : 1.0) + (mantissa * exp2(-23.0)));
	return final;
}

float getAudioSample(in float t) {
	float clamped = clamp(t, 0.0, u_numSamples - 1.0);
	float x = (mod(clamped, u_textureSize.x) + 0.5) / u_textureSize.x;
	float y = (floor(clamped / u_textureSize.x) + 0.5) / u_textureSize.y;
	return unpackPixel(texture2D(u_image0, vec2(x, y)));
}

float getAudioSampleLinear(in float t) {
	float samp1 = getAudioSample(floor(t));
	float samp2 = getAudioSample(ceil(t));
	return mix(samp1, samp2, fract(t));
}

vec2 gatherSamplesAtX(in float x) {
	const float numSamples = 100.0;
	float halfPixelWidth = 1.0 / u_canvasSize.x;
	float sampleStart = (x - halfPixelWidth) * u_numSamples;
	float sampleEnd = (x + halfPixelWidth) * u_numSamples;
	float wave = 0.0;
	float maximum = 0.0;
	float avg = 0.0;
	for (float i = 0.0; i < numSamples; i++) {
		wave = abs(getAudioSampleLinear(mix(sampleStart, sampleEnd, i / numSamples)));
		avg += wave * wave;
		maximum = max(maximum, wave);
	}
	avg = sqrt(avg / numSamples);
	return vec2(avg, maximum);
}

float wave (in vec2 coord) {
	vec2 sample = gatherSamplesAtX(coord.x);
	float avg = sample.x;
	float maximum = sample.y;
	float centerDistance = abs(coord.y - 0.5) * 2.0;
	// Add 2px center line
	centerDistance -= (avg + (2.0 / u_canvasSize.y));
	centerDistance /= maximum - avg;
	return clamp(centerDistance, 0.0, 1.0);
}

void main () {
	float centerDistance = wave(v_texCoord);

	gl_FragColor = mix(
			vec4(189.0/255.0, 66.0/255.0, 189.0/255.0, 1.0),
			vec4(0.0),
			centerDistance
		);
	//gl_FragColor = vec4(v_texCoord, 0.0, 1.0);
}
