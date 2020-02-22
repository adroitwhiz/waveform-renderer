const createShader = (gl, source, type) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        throw new Error(`Could not compile WebGL program. \n${info}`);
    }

    return shader;
};

class WaveformRenderer {
    constructor (canvas) {
        this._canvas = canvas;
        this._gl = null;
        this._samples = null;
        this._textureData = null;

        this._createContext();
    }

    _createContext () {
        const contextAttributes = {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false
        };
        const gl = this._canvas.getContext('webgl', contextAttributes) ||
            this._canvas.getContext('experimental-webgl', contextAttributes);
        this._gl = gl;

        const vertShader = createShader(gl, VERTEX_SOURCE, gl.VERTEX_SHADER);
        const fragShader = createShader(gl, FRAGMENT_SOURCE, gl.FRAGMENT_SHADER);

        console.log(FRAGMENT_SOURCE);

        const program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);
        this._shader = program;

        // Construct maps of uniform + attrib locations for convenience
        this._uniforms = new Map();
        this._attribs = new Map();

        const numActiveUniforms = gl.getProgramParameter(
            program,
            gl.ACTIVE_UNIFORMS
        );
        for (let i = 0; i < numActiveUniforms; i++) {
            const uniformInfo = gl.getActiveUniform(program, i);
            this._uniforms.set(
                uniformInfo.name,
                gl.getUniformLocation(program, uniformInfo.name)
            );
        }

        const numActiveAttributes = gl.getProgramParameter(
            program,
            gl.ACTIVE_ATTRIBUTES
        );
        for (let i = 0; i < numActiveAttributes; i++) {
            const attribInfo = gl.getActiveAttrib(program, i);
            this._attribs.set(
                attribInfo.name,
                gl.getAttribLocation(program, attribInfo.name)
            );
        }

        const buffer = gl.createBuffer();
        gl.enableVertexAttribArray(this._attribs.get('a_position'));
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(
            this._attribs.get('a_position'),
            2, // vec2
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                0, 0,
                0, 1,
                1, 0,

                1, 1,
                0, 1,
                1, 0
            ]),
            gl.STATIC_DRAW
        );

        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this._uniforms.get('u_image0'), 0);

        this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this._texture = gl.createTexture();
    }

    setAudioSamples (samples) {
        const gl = this._gl;
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        if (this._textureData === null || this._textureData.length < samples.length * 4) {
            let textureWidth = Math.min(this._maxTextureSize, samples.length);
            let textureHeight = Math.ceil(samples.length / textureWidth);

            // unfortunately, if the audio file is too long to fit into a single WebGL texture
            // (over 95 seconds of 44100Hz audio for the minimum spec-guaranteed 2048x2048),
            // it must be downsampled.
            if (textureHeight > this._maxTextureSize) {
                const maxNumSamples = this._maxTextureSize * this._maxTextureSize;
                const sampleStride = Math.ceil(samples.length / maxNumSamples);
                const resampled = new Float32Array(Math.ceil(samples.length / sampleStride));
                for (let i = 0; i < resampled.length; i++) {
                    resampled[i] = samples[i * sampleStride];
                }
                textureWidth = Math.min(this._maxTextureSize, resampled.length);
                textureHeight = Math.ceil(resampled.length / textureWidth);
                samples = resampled;
            }

            this._textureData = new Uint8Array(textureWidth * textureHeight * 4);
            this._textureSize = [textureWidth, textureHeight];
        }

        this._samples = samples;

        // The secret sauce to speedy rendering:
        // Reinterpret the array of audio samples (32-bit floats) as 8-bit integers--no looping, no conversion.
        // In the fragment shader, each RGBA quadruplet will be re-reinterpreted as a float again.
        this._textureData.set(new Uint8Array(samples.buffer));

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this._textureSize[0],
            this._textureSize[1],
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this._textureData
        );

        gl.uniform2fv(this._uniforms.get('u_textureSize'), this._textureSize);
        gl.uniform1f(this._uniforms.get('u_numSamples'), samples.length);
    }

    resize (width, height) {
        const gl = this._gl;
        const canvas = this._canvas;
        canvas.width = width;
        canvas.height = height;
        gl.uniform2f(this._uniforms.get('u_canvasSize'), width, height);
        gl.viewport(0, 0, width, height);
        this.draw();
    }

    draw () {
        const gl = this._gl;
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    destroy () {
        const gl = this._gl;
        gl.deleteTexture(this._texture);
        this._gl = null;
    }
}

export default WaveformRenderer;
