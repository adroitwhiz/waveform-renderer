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

const createProgram = (gl, vertSource, fragSource) => {
    const vertShader = createShader(gl, vertSource, gl.VERTEX_SHADER);
    const fragShader = createShader(gl, fragSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    const programInfo = {
        uniforms: {},
        attribs: {},
        program
    }

    // Construct maps of uniform + attrib locations for convenience
    const numActiveUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numActiveUniforms; i++) {
        const uniformInfo = gl.getActiveUniform(program, i);
        programInfo.uniforms[uniformInfo.name] =  gl.getUniformLocation(program, uniformInfo.name);
    }

    const numActiveAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numActiveAttributes; i++) {
        const attribInfo = gl.getActiveAttrib(program, i);
        programInfo.attribs[attribInfo.name] =  gl.getAttribLocation(program, attribInfo.name);
    }

    return programInfo;
}

class WaveformRenderer {
    constructor (canvas) {
        this._canvas = canvas;
        this._gl = null;
        this._samples = null;
        this._textureData = null;
        this._size = [0, 0];

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

        // Use minimum precision necessary to guarantee at least 16 bits of precision
        let floatPrecisionString;
        for (const precisionType of [gl.LOW_FLOAT, gl.MEDIUM_FLOAT, gl.HIGH_FLOAT]) {
            const precisionBits = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, precisionType).precision;
            if (precisionBits >= 16) {
                switch (precisionType) {
                    case gl.LOW_FLOAT: floatPrecisionString = 'precision lowp float;\n'; break;
                    case gl.MEDIUM_FLOAT: floatPrecisionString = 'precision mediump float;\n'; break;
                    case gl.HIGH_FLOAT: floatPrecisionString = 'precision highp float;\n'; break;
                }
                break;
            }
        }

        this._audioLevelShader = createProgram(gl, VERTEX_SOURCE, floatPrecisionString + AUDIO_CALC_SOURCE);
        this._waveformShader = createProgram(gl, VERTEX_SOURCE, floatPrecisionString + FRAGMENT_SOURCE);

        const buffer = gl.createBuffer();
        gl.enableVertexAttribArray(this._waveformShader.attribs.a_position);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(
            this._waveformShader.attribs.a_position,
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

        gl.activeTexture(gl.TEXTURE0);

        this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        // create once for better performance (this is uploaded as the texture for the audio level framebuffer)
        this._fullRow = new Uint8Array(this._maxTextureSize * 4);

        this._sampleTexture = gl.createTexture();
        this._audioLevelTexture = gl.createTexture();
        this._audioLevelFramebuffer = gl.createFramebuffer();

        this._scrollRangeStart = 0;
        this._scrollRangeEnd = 1;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._audioLevelFramebuffer);
        gl.bindTexture(gl.TEXTURE_2D, this._audioLevelTexture);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._audioLevelTexture, 0);
    }

    setAudioSamples (samples) {
        const gl = this._gl;
        gl.bindTexture(gl.TEXTURE_2D, this._sampleTexture);
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
    }

    resize (width, height) {
        const gl = this._gl;
        const canvas = this._canvas;
        canvas.width = width;
        canvas.height = height;

        this._size[0] = width;
        this._size[1] = height;

        gl.bindTexture(gl.TEXTURE_2D, this._audioLevelTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this._fullRow);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._audioLevelFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._audioLevelTexture, 0);

        if (this._samples) this.draw();
    }

    setScrollRange(start, end) {
        this._scrollRangeStart = start;
        this._scrollRangeEnd = end;

        if (this._samples) this.draw();
    }

    draw () {
        const gl = this._gl;

        // Calculate audio levels for each pixel column
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._audioLevelFramebuffer);
        gl.bindTexture(gl.TEXTURE_2D, this._sampleTexture);

        gl.useProgram(this._audioLevelShader.program);
        gl.uniform2fv(this._audioLevelShader.uniforms.u_canvasSize, this._size);
        gl.uniform2fv(this._audioLevelShader.uniforms.u_textureSize, this._textureSize);
        gl.uniform2f(this._audioLevelShader.uniforms.u_scrollRange, this._scrollRangeStart, this._scrollRangeEnd);
        gl.uniform1f(this._audioLevelShader.uniforms.u_numSamples, this._samples.length);
        gl.uniform1i(this._audioLevelShader.uniforms.u_image0, 0);

        gl.viewport(0, 0, this._size[0], 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Draw columns
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, this._audioLevelTexture);

        gl.useProgram(this._waveformShader.program);
        gl.uniform1i(this._waveformShader.uniforms.u_image0, 0);
        gl.uniform2fv(this._waveformShader.uniforms.u_canvasSize, this._size);

        gl.viewport(0, 0, this._size[0], this._size[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    destroy () {
        const gl = this._gl;
        gl.deleteTexture(this._sampleTexture);
        gl.deleteTexture(this._audioLevelTexture);
        gl.deleteFramebuffer(this._audioLevelFramebuffer);
        this._gl = null;
    }
}

export default WaveformRenderer;
