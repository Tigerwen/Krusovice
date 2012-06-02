/**
 * WebGL post-processing tricks module.
 *
 * These effects are bound to Krusovice world model - what kind of objects there is (photo frame etc.)
 * and cannot be re-used as is.
 *
 * https://bdsc.webapps.blackberry.com/html5/apis/WebGLRenderingContext.html
 *
 */

/*global define, window, jQuery, document, setTimeout, console, $, krusovice */

define(["krusovice/thirdparty/jquery-bundle", "krusovice/thirdparty/three-bundle"],
function($, THREE) {

    "use strict";

    /**
     * Rendering pre- and post-processing effects on the scene.
     */
    function PostProcessor() {
    }

    PostProcessor.prototype = {

        /** THREE rendering instance (not our show renderer) */
        renderer : null,

        /** All polygons will use special material - mostly used for speed in Stencil tests */
        overrideMaterial : null,

        /** Used by 2d post-processing */
        camera2d : null,
        geometry2d : null,
        quad2d : null,
        scene2d : null,

        init : function(renderer, width, height) {

            if(!renderer) {
                throw new Error("Must give proper THREE.Renderer instance");
            }

            this.renderer = renderer;
            this.width = width;
            this.height = height;
            this.passes = [];
        },

        /**
         * Add one effect to the chain.
         *
         */
        addPass : function(effect) {
            this.passes.push(effect);
        },

        /**
         * Create orthonagonal camera, good for 2D effect purposes.
         *
         * You will write to a hidden bugger and then use it as a texture with this dummy scene.
         * @return {[type]} [description]
         */
        setup2DCamera : function() {
            var width = this.width, height = this.height;

            this.camera2d = new THREE.OrthographicCamera(width / - 2, width / 2, height / 2, height / - 2, -10000, 10000 );
            this.geometry2d = new THREE.PlaneGeometry(1, 1);
            this.geometry2d.applyMatrix( new THREE.Matrix4().makeRotationX( Math.PI / 2 ) );

            this.quad2d = new THREE.Mesh(this.geometry2d, null);
            this.quad2d.position.z = -100;
            this.quad2d.scale.set(width, height, 1);

            this.scene2d = new THREE.Scene();
            this.scene2d.add(this.quad2d);
            this.scene2d.add(this.camera2d);
        },

        /**
         * Prepare for rendering. Must be called after all passes have been added to the chain.
         *
         */
        prepare : function() {
            var self = this,
                rtParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat};

            this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, rtParameters);

            this.passes.forEach(function(e) {
                e.init(self);
            });

            // Set renderer to play along with our stencil buffer pipeline
            this.renderer.autoClear = false;
            //this.autoClearColor = true;
            //this.autoClearDepth = true;
            this.autoClearStencil = false;

            this.setup2DCamera();
        },

        renderPass : function(pass, renderTarget, scene, camera) {
            pass.render(renderTarget, scene, camera);
        },


        /**
         * Main scene renderer function.
         *
         * Take over rendering control from the main rendering functoin.
         *
         * @param  {Canvas} frontBuffer Where all the result goes
         */
        render : function(frontBuffer, scene, camera) {
            var self = this;

            // color + depth + stencil
            this.renderer.clear(true, true, true);

            var i;

            for(i=0; i<this.passes.length; i++) {
                var pass = this.passes[i];
                var target = this.renderTarget;
                this.renderPass(pass, target, scene, camera);
            }

            // Dump WebGL canvas on 2D canvas
            frontBuffer.drawImage(this.renderer.domElement, 0, 0, this.width, this.height);
        },

        /**
         * Monkey-patch the renderer instance to use our functions
         *
         */
        takeOver : function(krusoviceRenderer) {

            var self = this;

            function renderGL(frontBuffer) {
                /*jshint validthis:true */
                self.render(frontBuffer, this.scene, this.camera);
            }

            krusoviceRenderer.renderGL = renderGL;
        }
    };


    /**
     * Base class for post processors
     */
    function PostProcessingPass() {
    }

    PostProcessingPass.prototype = {

        postprocessor : null,

        renderer : null,

        /** Fill stencil with 0xff00ff color */
        stencilDebug : false,

        uniforms : null,

        /** THREE.js material used on 2D scene quad surface */
        material : null,

        init : function(postprocessor) {
            this.postprocessor = postprocessor;
            this.renderer = postprocessor.renderer;

            this.prepare();
        },

        /**
         * Child classes to override to setup shader code.
         */
        prepare : function() {

        },

        /**
         * Iterate scene and extract all materials out of it.
         *
         * XXX: Replace this with your own material registry.
         *
         * XXX: Use https://github.com/mrdoob/three.js/blob/master/src/extras/SceneUtils.js#L13
         */
        getMaterials : function(scene) {

            var materials = [];

            scene.children.forEach(function(child) {

                if(!child.geometry) {
                    // Light or something
                    return;
                }

                child.geometry.materials.forEach(function(material) {
                    if($.inArray(material, materials)) {
                        materials.push(material);
                    }
                });
            });

            return materials;
        },

        /**
         * Render the world with selected options.
         *
         * @param  {THREE.WebGLRenderTarget} renderTarget
         *
         * @oaram {Object} layers { frame : true, photo : true }
         */
        renderWorld : function(renderTarget, scene, camera, layers) {

            //scene.overrideMaterial = this.overrideMaterial;

            // Prepare what is visible in this pass
            //

            THREE.SceneUtils.traverseHierarchy(scene, function(object) {

                if(!(object instanceof THREE.Mesh)) {
                    // Skip lights and stuff
                    return;
                }

                var hint = object.krusoviceTypeHint;

                if(!hint) {
                    console.log(object);
                    throw new Error("Scene object lacks Krusovice post-processing rendering hints");
                }

                // Is the material layer on or off
                if(layers[hint]) {
                    //console.log("Visible:" + hint);
                    object.visible = true;
                } else {
                    //console.log("invisible:" + hint);
                    object.visible = false;
                }
            });

            scene.overrideMaterial = this.overrideMaterial;

            if(renderTarget) {
                // buffer
                this.renderer.render(scene, camera, renderTarget);
            } else {
                // screen
                this.renderer.render(scene, camera);
            }
            //
        },

        /**
         * Upload shader code to GPU
         */
        prepare2dEffect : function(shader) {
            this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);
            this.material = new THREE.ShaderMaterial( {
                uniforms: this.uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader
            });
        },

        /**
         * Renders a 2D fragment shader.
         *
         *
         */
        render2dEffect : function(readBuffer, writeBuffer) {
            var postprocessor = this.postprocessor;

            // Use existing real world scene buffer as source for the shader program
            //
            if(this.material.uniforms.tDiffuse) {
                this.material.uniforms.tDiffuse.texture = readBuffer;
            }

            this.postprocessor.quad2d.material = this.material;

            if(writeBuffer) {
                this.renderer.render(postprocessor.scene2d, postprocessor.camera2d, writeBuffer);
            } else {
                this.renderer.render(postprocessor.scene2d, postprocessor.camera2d);
            }
        },

        /**
         * Indicate how we are going to utilize the rendering mask
         */
        setMaskMode : function(mode) {

            var context = this.renderer.context;

            // This will fill the stencil buffer with 1 or 0
            // for the parts which are drawn. Later this stencil can be used for
            // effect passes
            if(mode == "fill" || mode == "negative-fill") {

                // This draw pass will lit stencil pixels, not normal pixels
                if(this.stencilDebug) {
                    // Render output visually
                    context.colorMask(true, true, true, true);
                } else {
                    // Don't touch RGBA data
                    context.colorMask(false, false, false, false);
                }

                context.depthMask(false);
                context.enable(context.STENCIL_TEST);
                context.clearStencil(mode == "fill" ? 0 : 1);

                //context.stencilMask(0xffFFffFF);

                context.stencilOp(context.REPLACE, context.REPLACE, context.REPLACE); // fail, zfail, zpass
                context.stencilFunc(context.ALWAYS, 1, 0xffFFffFF);

                this.overrideMaterial = new THREE.MeshBasicMaterial({ color : mode == "fill" ? 0xff00ff : 0x00ff00 });

            }  else if(mode == "clip") {
                // Only draw the effect on the pixels stenciled before

                context.enable(context.STENCIL_TEST);
                context.stencilFunc(context.EQUAL, 0, 0xffFFffFF);
                context.stencilOp(context.KEEP, context.KEEP, context.KEEP);

                context.colorMask(true, true, true, true);
                context.depthMask(true);

                this.overrideMaterial = null;

            } else {
                // Normal
                context.colorMask(true, true, true, true);
                context.depthMask(true);
                context.disable(context.STENCIL_TEST);
                this.overrideMaterial = null;
            }
        }
    };

    /**
     * WebGL effec composer which renders Sepia + Noise on the image itself
     */
    function SepiaPass(renderer) {
    }

    /**
     *
     *
     */
    $.extend(SepiaPass.prototype, PostProcessingPass.prototype, {

        prepare : function() {
            var sepia = THREE.ShaderExtras.sepia;
            //var sepia = THREE.ShaderExtras.basic;
            this.prepare2dEffect(sepia);
        },

        render : function(renderTarget, scene, camera) {

            if(!this.renderer) {
                throw new Error("Effect was never given a proper Renderer instance");
            }

            // Render world to the buffer
            renderTarget = this.postprocessor.renderTarget;

            // Draw frame as is
            this.setMaskMode("normal");
            this.renderWorld(renderTarget, scene, camera, { frame : true, photo : false });

            // Draw photo as is
            this.setMaskMode("normal");
            this.renderWorld(renderTarget, scene, camera, { photo : true });

            // Mask buffer for photo area
            this.setMaskMode("fill");
            var context = this.renderer.context;
            context.depthFunc(context.ALWAYS);
            this.renderWorld(renderTarget, scene, camera, { photo : true });

            // Run sepia filter against masked area
            this.setMaskMode("clip");
            this.render2dEffect(renderTarget, null);
        }

    });


    // Module exports
    return {
            PostProcessor : PostProcessor,
            SepiaPass : SepiaPass
    };


});