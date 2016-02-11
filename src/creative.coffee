class VASTCreative
    constructor: ->
        @trackingEvents = {}

class VASTCreativeLinear extends VASTCreative
    constructor: ->
        super
        @type = "linear"
        @duration = 0
        @skipDelay = null
        @mediaFiles = []
        @videoClickThroughURLTemplate = null
        @videoClickTrackingURLTemplates = []
        @videoCustomClickURLTemplates = []
        @adParameters = null

class VASTCreativeNonLinear extends VASTCreative
    constructor: ->
        @type = "nonLinear"
        @variations = []
        
class VASTCreativeCompanion extends VASTCreative
    constructor: ->
        @type = "companion"
        @variations = []

module.exports =
    VASTCreativeLinear: VASTCreativeLinear
    VASTCreativeNonLinear: VASTCreativeNonLinear
    VASTCreativeCompanion: VASTCreativeCompanion
