precision highp float;

attribute vec2 a_position;
varying vec2 v_texCoord;

void main () {
	gl_Position = vec4((a_position - 0.5) * 2.0, 0.0, 1.0);
	v_texCoord = a_position;
}
