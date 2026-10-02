// uncomment the import below for production, as well as the export at the bottom

import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	

	// from Parser_Core.mjs
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf,
	succeedWith,
	everythingUntil,
	except,
	strng,
	many1,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'

/****************************************************************************
* module: 			get_nxcfg_bgp_config
*	description:	parses the multi-vrf configuration of a Nexus BGP configuration
*	output:				table mirroring the important entries in the output:
*	
*				bgpAS: 					ASN of this Nexus's BGP configuration
*				vrf:    				VRF name
*				router-id:     	router-ID of this VRF instance
*				bgpNetworks: 		pipe-delimited list of networks in this VRF (via "network" statements)
*				neighbor:      	peer IP address
*				remoteAs:      	peer ASN
*				desc:    		  	peer description
*				timers:    	  	peer timers
*				address-family: address-family (as appears in configuration)
*				send-community: (as appears in configuration)
*				route-map-in    name of the inbound route-map,
*				next-hop-self   (as appears in the conifuration)   
*/

const restOfLine = rol

const get_nxcfg_bgp_config = (deviceName) => {
	const _1 = (result) => result[0] 			// shortcut to pull first item in array
	const _2 = (result) => result[1]			// shortcut to pull 2nd item in array

	const bgpNeighbor = seqOf(
		parseLine('neighbor', ipUC, 'remote-as', digits			).map( ([ , neighbor, , remoteAs]) => ({neighbor, remoteAs:remoteAs })).tag('bgpNeighborEntry') ,
		possibly(	parseLine(	'description', restOfLine			).map( _2 )		).tag('desc')							,
		possibly(	parseLine(	'timers', restOfLine					).map( _2 )		).tag('timers')						,
		possibly(	parseLine(	'address-family', restOfLine	).map( _2 )		).tag('address-family')		,
		possibly(	parseLine(	'send-community', restOfLine	).map( _2 )		).tag('send-community')		,
		possibly(	parseLine(	'route-map', hword, 'in'			).map( _2 )		).tag('route-map-in')			,
		possibly(	parseLine(	'route-map', hword, 'out'			).map( _2 )		).tag('route-map-out')			,
		possibly(	parseLine(	'next-hop-self'								).map( _1 )		).tag('next-hop-self')			,
		everythingUntil(parseLine(oneOf('neighbor', 'vrf')))				// record termination parser
	).getTaggedR()
		.map(flattenItem)

	const vrfBGP = seqOf(
		parseLine( 'vrf', hword ).map( _2 ).tag('vrf'), 
		parseLine( 'router-id', ipUC ).map( _2 ).tag('router-id'), 
		possibly(parseLine( 'log-neighbor-changes' )),
		parseLine( 'address-family ipv4 unicast' ),
		many(parseLine( 'network', ipNetwork ).map( _2)	).map(joinWith('|')).tag('bgpNetworks'),
		many(bgpNeighbor).tag('bgpNeighbors'),
	).getTaggedR()
		.map(multiplyBy('bgpNeighbors'))

	return seqOf(
		gotoSection('router bgp'),
		parseLine( 'router bgp', digits ).map(_2).tag('bgpAS'),
		many(vrfBGP).map(flattenArray).tagList('vrfBGP'),
	).getTaggedR()
		.map(multiplyBy('vrfBGP'))

}


// comment out in production:
// get_nxcfg_bgp_config('testDevice')


// end of module nexus_cfg_bgp
export { get_nxcfg_bgp_config }

