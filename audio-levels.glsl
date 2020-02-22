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

vec2 downsample(in float x) {
	const float maxSamples = 100000.0;

	float filterWidth = 4.0 / u_canvasSize.x;
	float left = x - filterWidth;
	float right = x + filterWidth;

	float leftSampleSpace = left * u_numSamples;
	float rightSampleSpace = right * u_numSamples;
	float widthSampleSpace = min(rightSampleSpace - leftSampleSpace, maxSamples);

	float weight = 0.0;
	float weightAccum = 0.0;

	float avg = 0.0;
	float maximum = 0.0;

	float startOffset = ceil(leftSampleSpace);
	float end = floor(rightSampleSpace) - startOffset;
	for (float i = 0.0; i < maxSamples; i++) {
		float progress = (i + startOffset) - leftSampleSpace;
		// Triangle filter
		weight = smoothstep(0.0, 1.0, 1.0 - (abs((progress / widthSampleSpace) - 0.5) * 2.0));
		weightAccum += weight;

		float wave = weight * abs(getAudioSample(i + startOffset));
		avg += wave * wave;
		maximum = max(maximum, wave);

		if (i > end) break;
	}

	avg = sqrt(avg / weightAccum);

	return vec2(avg, maximum);
}

void main () {
	//vec2 sampleValue = gatherSamplesAtX(v_texCoord.x);
	//float sampleValue = getAudioSampleLinear(v_texCoord.x * u_numSamples);
	vec2 sampleValue = downsample(v_texCoord.x);

	gl_FragColor = vec4(sampleValue, 0.0, 1.0);
	//gl_FragColor = vec4(v_texCoord, 0.0, 1.0);
}
