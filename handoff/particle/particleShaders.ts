export const particleVertex = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aSeed;
  varying float vSeed;

  void main() {
    vSeed = aSeed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Perspective size attenuation: closer particles render larger.
    gl_PointSize = uSize * uPixelRatio * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const particleFragment = /* glsl */ `
  precision mediump float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;

  varying float vSeed;

  void main() {
    // Round, soft-edged sprite with a brighter glowing core.
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.04, d);
    float core = smoothstep(0.34, 0.0, d);

    vec3 col = mix(uColorA, uColorB, vSeed);
    col += core * 0.55; // additive-friendly hot center

    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;
