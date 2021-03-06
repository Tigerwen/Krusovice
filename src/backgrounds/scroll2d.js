/**
 * 2D parallax scroller.
 *
 * Scroll & rotate inside a bigger continuous 2D texture.
 */

/*global define, console, jQuery, document, setTimeout */

define("krusovice/backgrounds/scroll2d", ["krusovice/thirdparty/jquery-bundle", "krusovice/core", "krusovice/backgrounds"], function($, krusovice, backgrounds) {

"use strict";

backgrounds.Scroll2D = function(options, data) {
    this.data = data;
    this.options = options;
};

$.extend(backgrounds.Scroll2D, {

    /**
     * @cfg {Boolean} rotate Allow rotating texture
     */
    rotate : true,

    /**
     * @cfg {String} image id or URL
     */
    image : null,

    maxZoom : 0,

    minZoom : 0,

    /**
     * How many pixels move at once
     */
    maxMove : 500,

    /**
     * How many seconds we vary between movements
     */
    spanVariation : 10,

    /**
     * Average duration of camera movement
     */
    spanDuration : 15,


    /**
     *
     */
    beatSeekWindow : 2,


    calculateKeyFrame : function(t, oldFrame, cfg) {
        var frame = {};

        frame.clock = t;

        frame.width = krusovice.utils.rangernd(cfg.zoomSizes.minW, cfg.zoomSizes.maxW);
        frame.height = krusovice.utils.rangernd(cfg.zoomSizes.minH, cfg.zoomSizes.maxH);

        function goodxy(x, y) {
            if(x + frame.width > cfg.orignalSize.width) {
                return false;
            }

            if(x < 0) {
                return false;
            }

            if(y + frame.height > cfg.orignalSize.height) {
                return false;
            }

            if(y < 0) {
                return false;
            }

            return true;
        }

        // Keep guessing until

        var attemps = 100;

        frame.x = -1;
        frame.y = -1;
        while(attemps-- && !goodxy(frame.x, frame.y)) {
            frame.x = (oldFrame.x||0) + krusovice.utils.splitrnd(cfg.maxMove || this.maxMove);
            frame.y = (oldFrame.y||0) + krusovice.utils.splitrnd(cfg.maxMove || this.maxMove);
        }

        if(attemps === 0) {
            console.error(oldFrame);
            console.error(this.image);
            throw "Could not create key frame";
        }

        return frame;
    },

    createAnimation : function(duration, timeline, analysis, cfg) {

        var params = $.extend({}, cfg);
        var data = [];
        var frame, oldFrame;
        var t = 0;

        var startFrame = {
            x : krusovice.utils.rangernd(0, cfg.orignalSize.width - cfg.zoomSizes.maxW),
            y : krusovice.utils.rangernd(0, cfg.orignalSize.height - cfg.zoomSizes.maxH)
        };

        frame = this.calculateKeyFrame(0, startFrame, cfg);

        data.push(frame);
        oldFrame = frame;
        while(t < duration) {
            var span = this.spanDuration + krusovice.utils.splitrnd(this.spanVariation);
            t += span;
            frame = this.calculateKeyFrame(t, oldFrame, cfg);
            data.push(frame);
            oldFrame = frame;
        }

        params.frames = data;
        return params;

    }

});

krusovice.backgrounds.Scroll2D.prototype = {

    /**
     * PADI says it is 5 meters.
     */
    safetyStop : function(cfg) {

        // Make sure viewport is smaller then the background image
        if(this.width > cfg.orignalSize.width || this.height > cfg.orignalSize.height) {
            console.error(cfg);
            throw "Viewport is bigger than background image";
        }
    },


    /**
     * @cfg {String|Object} image
     *
     * @cfg {Array} frames
     */

    prepare : function(loader, width, height) {

        this.width = width;
        this.height= height;

        this.safetyStop(this.data);

        // Create a working copy of the data
        this.frames = this.data.frames.slice(0);

        var imageURL = this.data.image;

        var self = this;

        // Convert URL to real loaded image object
        function loadedImage(image) {
            console.log("Loaded background image:" + imageURL);
            console.log(image);
            self.image = image;
        }

        loader.loadImage(imageURL, $.proxy(loadedImage, this));
    },

    getFramePair : function(clock, frames) {
        var i;

        for(i=0; i<frames.length; i++) {
            if(frames[i].clock > clock) {
                var lastFrame = frames[i-1];
                var currentFrame = frames[i];
                var delta = (clock - lastFrame.clock) / (currentFrame.clock - lastFrame.clock);

                return {last : lastFrame, current : currentFrame, delta : delta, index : i};
            }
        }

        return null;
    },

    render : function(ctx, clock) {

        var frames = this.getFramePair(clock, this.data.frames);

        if(!frames) {
            console.error("scroll2d background time overflow:" + clock);
            return;
        }

        if(!this.image) {
           throw "Background image missing when scalling Scroll2D.render()";
        }

        //var eased = krusovice.utils.ease("linear", 0, 1, frames.delta);


        // Fix zoom aspect ratio
        var lastShrinked = krusovice.utils.shrinkToAspectRatio(frames.last.width, frames.last.height, this.width, this.height);
        var currentShrinked = krusovice.utils.shrinkToAspectRatio(frames.current.width, frames.current.height, this.width, this.height);

        var x = krusovice.utils.easeRange("easeInOutSine", frames.last.x, frames.current.x, frames.delta);
        var y = krusovice.utils.easeRange("easeInOutSine", frames.last.y, frames.current.y, frames.delta);
        var w = krusovice.utils.easeRange("easeInOutSine", lastShrinked.width, currentShrinked.width, frames.delta);
        var h = krusovice.utils.easeRange("easeInOutSine", lastShrinked.height, currentShrinked.height, frames.delta);

        if(h >= this.image.height) {
            h = this.image.height;
        }

        if(y + h >= this.image.height) {
            y = this.image.height - h;
        }

        if(w >= this.image.width) {
            w = this.image.width;
        }

        if(x + w >= this.image.width) {
            x = this.image.width - x;
        }


        if(ctx)  {
            if(!ctx) {
                throw "oops";
            }
            //console.log("Scroll 2D bg draw index:" + frames.index + " delta:" + frames.delta + " x:" + x + " y:" + y + " w:" + w +  " h:" + h + " width:" + this.width +  " height:" + this.height);
            // https://developer.mozilla.org/en/Canvas_tutorial/Using_images#Slicing
            ctx.drawImage(this.image, x, y, w, h, 0, 0, this.width, this.height);
        }

    }

};

return backgrounds.scroll2d;

});