uniform sampler2D u_image0;
uniform vec2 u_canvasSize;
varying vec2 v_texCoord;

float wave (in vec2 coord) {
	vec4 sample = texture2D(u_image0, vec2(coord.x, 0.5));
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
}
