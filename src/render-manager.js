//import THREE from "three";

import GLRaycaster, { GLRaycasterParams } from "./glraycaster";
import PostProcessing from "./post-processing";
import WebVrWrapper from "./webvr";
import Network from "../miniviews/network";
import RenderQuality from "../render-quality";

// Just so that someone doesn't get a bright idea to modify these directly.
/**
 * @type {THREE.WebGLRenderer}
 */
let rendererMain = null;

/**
 * @type {GLRaycaster}
 */
let webGLRaycaster = null;

/**
 * @type {PostProcessing}
 */
let postProcessing = null;

/**
 * @type {WebVrWrapper}
 */
let webVrWrapper = null;

let isInitialized = false;

const boundingRect = new THREE.Box2();
const viewPort = {
  left: NaN,
  top: NaN,
  bottom: NaN,
  right: NaN
};

let vpWidth, vpHeight;
let supportedTextures;

const NAMESPACE_SVG = "http://www.w3.org/2000/svg"; //DevSkim: ignore DS137138
const overlay2d = document.createElement("div");
const domElement = document.createElement("div");
const canvasHolder = document.createElement("div");
const overlaySVG = document.createElementNS(NAMESPACE_SVG, "svg");
domElement.appendChild(canvasHolder);

domElement.setAttribute("main-canvas", "");
domElement.id = "main-canvas";

let fog = null;

function onFocus() {
  if (
    Q3.selected &&
    Q3.selected.type === "LiveLabel" &&
    Q3.selected.element.isActive &&
    Q3.editMode
  ) {
    Q3.selected.element.input.focus();
  }
}

function onLoseFocus() {}

domElement.addEventListener("mouseenter", onFocus, false);
domElement.addEventListener("mouseleave", onLoseFocus, false);

/**
 * @type {THREE.Scene}
 */
const scene = new THREE.Scene();
scene.name = "RootScene";

/**
 * @type {THREE.Scene}
 */
let activeScene = null;

/**
 * @type {THREE.Camera}
 */
let camera = null;

let enableOutline = true,
  enableHighlight = true;

/**
 * @type {THREE.WebGLRendererParameters}
 */
let initGlParams;

/**
 * @type {GLRaycasterParams}
 */
let initRcParams;

let renderQuality;

let lastFaceCount = 0;

class RenderManager {
  constructor() {}

  tryRestoreContext() {
    if (!isInitialized) throw new Error("Can't restore uninitialized content.");

    rendererMain.domElement.remove();
    rendererMain.dispose();

    rendererMain = new THREE.WebGLRenderer(initGlParams);
    canvasHolder.appendChild(rendererMain.domElement);

    function disposeObjectContext(scene) {
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
        if (object.dispose) object.dispose();

        if (object.material) object.material.needsUpdate = true;
      });
    }

    disposeObjectContext(scene);

    postProcessing = new PostProcessing({
      renderer: rendererMain,
      scene,
      camera,
      renderQuality
    });
    webVrWrapper = new WebVrWrapper(rendererMain);
    webGLRaycaster.dispose();

    this.setSize(vpWidth, vpHeight);

    this.compile(scene, camera);

    camera.update = true;
  }

  get activeScene() {
    return activeScene;
  }

  setActiveScene(inScene) {
    if (activeScene) scene.remove(activeScene);

    scene.add(inScene);
    activeScene = inScene;
    Q3.scene = activeScene;
    activeScene.fog = fog;

    Network.setActive(activeScene);
  }

  setFog(newFog) {
    fog = newFog;
    scene.fog = fog;
    if (activeScene) {
      activeScene.fog = fog;
    }
  }

  getFog() {
    return fog;
  }

  /**
   *
   * @param {THREE.WebGLRendererParameters} glParams WebGL render context parameters.
   * @param {GLRaycasterParams} rcParams Raycaster parameters.
   */
  init(glParams = {}, rcParams = {}, inScene, inCamera, inRenderQuality) {
    if (isInitialized) throw new Error("Already initiallized.");

    Network.registerWorld(inScene);
    Network.setActive(inScene);

    scene.add(inScene);
    activeScene = inScene;

    camera = inCamera;
    renderQuality = inRenderQuality;

    initGlParams = glParams;
    initRcParams = rcParams;

    // const canvas = glParams.canvas || document.createElement("canvas");
    // const context =  glParams.context || BrowserCapabilities.isWebGl2 ? canvas.getContext("webgl2") : (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));

    // glParams.canvas = canvas;
    // glParams.context = context;

    rendererMain = new THREE.WebGLRenderer(glParams);
    webGLRaycaster = new GLRaycaster(rcParams);
    postProcessing = new PostProcessing({
      renderer: rendererMain,
      scene,
      camera,
      renderQuality
    });
    webVrWrapper = new WebVrWrapper(rendererMain);

    const gl = rendererMain.getContext();
    supportedTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

    canvasHolder.appendChild(rendererMain.domElement);
    domElement.appendChild(overlay2d);
    domElement.appendChild(overlaySVG);

    overlay2d.setAttribute("class", "overlay2d");
    overlaySVG.setAttribute("class", "overlay2d");
    overlaySVG.style.pointerEvents = "none";

    Object.defineProperty(domElement, "width", {
      get: () => {
        return vpWidth;
      },
      set: () => {
        throw new Error("Unsupported operation 'width'.");
      }
    });

    Object.defineProperty(domElement, "height", {
      get: () => {
        return vpHeight;
      },
      set: () => {
        throw new Error("Unsupported operation 'height'.");
      }
    });

    isInitialized = true;

    // Workaround for https://github.com/mrdoob/three.js/issues/9108
    // in case of using logaritmic depth buffer the shadows from directinal light are not working
    // this workeround disables log depth buffer only for shadow map rendering
    const originalRenderFunf = rendererMain.shadowMap.render;
    rendererMain.shadowMap.render = function() {
      const tmp = rendererMain.capabilities.logarithmicDepthBuffer;
      rendererMain.capabilities.logarithmicDepthBuffer = false;
      originalRenderFunf.apply(rendererMain.shadowMap, arguments);
      rendererMain.capabilities.logarithmicDepthBuffer = tmp;
    };

    return this;
  }

  getSupportedExtensions() {
    return rendererMain.context.getSupportedExtensions();
  }

  setSize(w, h, updateStyle) {
    const pixelRatio =
      Q3.browserCapabilities.renderQuality >= RenderQuality.NORMAL
        ? window.devicePixelRatio || 1
        : 1;

    rendererMain.setSize(w, h, updateStyle);
    rendererMain.setPixelRatio(pixelRatio);
    webGLRaycaster.resize(w, h);
    postProcessing.composer.setSize(w * pixelRatio, h * pixelRatio);

    const rect = overlay2d.getBoundingClientRect();
    boundingRect.min.set(rect.left, rect.top);
    boundingRect.max.set(rect.right, rect.bottom);

    vpWidth = domElement.clientWidth;
    vpHeight = domElement.clientHeight;

    return this;
  }

  getSize() {
    return rendererMain.getSize();
  }

  updatePostProcessing(lastRenderer, data, editMode) {
    postProcessing.updatePostProcessing({
      lastRenderer,
      ppData: data,
      editMode,
      enableHighlight,
      enableOutline
    });

    return this;
  }

  set enableHighlight(val) {
    enableHighlight = val;
  }
  get enableHighlight() {
    return enableHighlight;
  }

  set enableOutline(val) {
    enableOutline = val;
  }
  get enableOutline() {
    return enableOutline;
  }

  get domElement() {
    return domElement;
  }

  set toneMapping(val) {
    rendererMain.toneMapping = val;
  }
  get toneMapping() {
    return rendererMain.toneMapping;
  }

  set toneMappingExposure(val) {
    rendererMain.toneMappingExposure = val;
  }
  get toneMappingExposure() {
    return rendererMain.toneMappingExposure;
  }

  set gammaInput(val) {
    rendererMain.gammaInput = val;
  }
  get gammaInput() {
    return rendererMain.gammaInput;
  }

  set gammaOutput(val) {
    rendererMain.gammaOutput = val;
  }
  get gammaOutput() {
    return rendererMain.gammaOutput;
  }

  get info() {
    return rendererMain.info;
  }

  get shadowMap() {
    return rendererMain.shadowMap;
  }

  get pixelRatio() {
    return rendererMain.getPixelRatio();
  }

  set localClippingEnabled(val) {
    rendererMain.localClippingEnabled = val;
  }
  get localClippingEnabled() {
    return rendererMain.localClippingEnabled;
  }

  getViewPort() {
    return Object.freeze({
      left: viewPort.left,
      top: viewPort.top,
      right: viewPort.right,
      bottom: viewPort.bottom
    });
  }

  setViewport(left, top, width, height) {
    Object.assign(viewPort, {
      top: top,
      left: left,
      bottom: top + height,
      right: left + width
    });

    rendererMain.setViewport(left, top, width, height);
    webGLRaycaster.setViewport(left, top, width, height);
  }

  setScissor(x, y, w, h) {
    rendererMain.setScissor(x, y, w, h);
    webGLRaycaster.setScissor(x, y, w, h);
  }

  get overlay2d() {
    return overlay2d;
  }
  get overlay2dBounds() {
    return boundingRect;
  }
  get overlaySVG() {
    return overlaySVG;
  }
  get webVrWrapper() {
    return webVrWrapper;
  }
  get raycaster() {
    return webGLRaycaster;
  }

  enqueRaycaster(force = false) {
    webGLRaycaster.enqueFrame(rendererMain, camera, force);
  }

  compile(scene, camera) {
    rendererMain.compile(scene, camera);
  }

  getExtension(ext) {
    return rendererMain.context.getExtension(ext);
  }
  getParameter(param) {
    return rendererMain.context.getParameter(param);
  }

  get mainRenderer() {
    return rendererMain;
  }

  get isRaycasterReady() {
    return webGLRaycaster.isReady;
  }
  update() {
    webGLRaycaster.updateBuffers(rendererMain);
  }
  compose(delta) {
    scene.traverse(object => {
      if (object.isAtom) object.update();

      if (object.material && object.material.isMeshNestedMaterial) {
        object.material.updateLayers(object, webGLRaycaster);
      }
    });

    rendererMain.info.autoReset = false;

    const gatePass = postProcessing.passRenderGates.get();
    if (gatePass) {
      gatePass.setGates(Network.gates);
    }

    postProcessing.composer.render(delta);

    function selectVisibleObjects() {
      let triangles = 0;
      if (Q3.data.slides[Q3.slide].layers.Renderer)
        [Network.world, { scene: Q3.gateNetwork.parent }]
          .concat(Network.gates)
          .forEach(world => {
            world.scene &&
              world.scene.traverseVisible(object => {
                if (Q3.data.assets.objects[object.uuid] && object.geometry) {
                  const index = object.geometry.getIndex();
                  const vertices =
                    !index && object.geometry.getAttribute("position");

                  triangles =
                    triangles + (index ? index.count : vertices.count) / 3;
                }
              });
          });

      return triangles;
    }

    lastFaceCount = selectVisibleObjects();

    rendererMain.info.autoReset = true;
  }

  get isContextLost() {
    return rendererMain.getContext().isContextLost();
  }

  setOutlineObjects(objects = []) {
    const pass = postProcessing.passOutline.get();

    if (!pass) return;

    while (pass.selectedObjects.pop()) {}

    objects = objects instanceof Array ? objects : [objects];

    objects.forEach(object => pass.selectedObjects.push(object));
  }

  setHighlightObjects(objects = []) {
    const pass = postProcessing.passHighlight.get();

    if (!pass) return;

    while (pass.selectedObjects.pop()) {}

    objects = objects instanceof Array ? objects : [objects];
    Object.keys(Q3.data.assets.objects).forEach(uuid => {
      if (Q3.data.assets.objects[uuid].highlight === "on") {
        objects.push(Q3.scene.getObjectByProperty("uuid", uuid));
      }
    });
    objects.forEach(object => pass.selectedObjects.push(object));
  }

  toDataURL() {
    return rendererMain.domElement.toDataURL();
  }

  clearOverlay(overlay) {
    overlay.clear(rendererMain);
  }

  renderOverlay(overlay, params) {
    overlay.render(rendererMain, scene, camera, params);
  }

  get faces() {
    return lastFaceCount;
  }

  get root() {
    return scene;
  }

  get maxTextureUnits() {
    return supportedTextures;
  }

  toScreenCoords(x, y, out = new THREE.Vector2()) {
    const px = Math.round((vpWidth * x + vpWidth) / 2);
    const py = Math.round((vpHeight - vpHeight * y) / 2);

    return out.set(px, py);
  }

  toScreenSpaceCoords(x, y, out = new THREE.Vector2()) {
    if (y === undefined) {
      y = x.y;
      x = x.x;
    }

    const vp = this.getViewPort(),
      vpWidth = vp.right - vp.left,
      vpHeight = vp.bottom - vp.top;

    out.x = (x / vpWidth) * 2 - 1;
    out.y = 1 - (y / vpHeight) * 2;

    return out;
  }
}

const instance = new RenderManager();

export default instance;
export { instance as RenderManager };

// WEBPACK FOOTER //
// ./src/Q3/rendering/render-manager.js
