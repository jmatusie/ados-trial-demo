import { hostnameFromConfig } from '../../Parser_Network.mjs'

const {
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy 
} = await import('../../Parser_Result_Helpers.mjs')


const {
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf, 
	succeedWith
} = await import('../../Parser_Core.mjs')


const {
	parseLine,
	digits,
	rol,
	hword,
	at_eol
} = await import('../../Parser_Text.mjs')


const {
	ipAddress,
	ipMC,
	ipNetwork,
	ipUC,
	gotoSection,
} = await import('../../Parser_Network.mjs')


const { 
	endOfIndentLevel, 
	gotoStr, 
	until,
	goto,
} = await import ('../../Parser_FlexParser.mjs')




/****************************************************************************
* module: 			nxos_cfg_bgp_peers (v2 output)
*	description:
*	output:				
*/
const nxos_cfg_bgp_peers = ( () => {

const pmodule = {
	name: 'nxos_cfg_bgp_peers',
	ver: 1.0
}
		
const _0 = (arr) => arr[0]
const _1 = (arr) => arr[1]
const _2 = (arr) => arr[2]
const _3 = (arr) => arr[3]
const isTrue = (res) => true
		
// common tokens
const asplain = digits
const asdot = sequenceOf(digits, '.', digits)
const asn = oneOf(asplain, asdot)
const vrfName = regex(/^[a-zA-Z0-9_-]+/)
const routeMapName = regex(/^[a-zA-Z0-9_-]+/)
const timerSeconds = digits
			
// raw line parsers for nxos bgp
const bgpHeader 					= parseLine( 'router bgp', asn ).map( _1 )
const af_ipv4_unicast 		= parseLine( 'address-family', 'ipv4', 'unicast' ).map((res)=>true)
const af_other 						= parseLine( 'address-family', hword, rol ).map( joinWith(':') )
			
// vrf lines
const vrfHeader						= parseLine( 'vrf', vrfName ).map( _1 )
const routerID						= parseLine( 'router-id', ipUC ).map( _1 )
const logNeighborChanges 	= parseLine( 'log-neighbor-changes' ).map( isTrue )
			
// vrf->address-family ipv4 lines
const network							= parseLine( 'network', ipNetwork, at_eol).map( _1 )
const network_plus				= parseLine( 'network', ipNetwork, rol)
	.logResult(`[${pmodule.name}]:network_plus: information after network statement`)
			
// neighbor lines
const neighborHeader 			= parseLine( 'neighbor', ipUC.tag('peerIP'), 'remote-as', asn.tag('peerAS') )
const localAs							= parseLine( 'local-as', asn ).map( _1 )
const description					= parseLine( 'description', rol ).map( _1 )
const isShutdown					= parseLine( 'shutdown' ).map( isTrue )
const timers 							= parseLine( 'timers', timerSeconds, timerSeconds ).map( ([_,_1,_2])=>`${_1}:${_2}` )
			
// neighbor->address-family ipv4 lines
const sendCommunity				= parseLine( 'send-community', at_eol).map( isTrue )
const sendCommunityExt		= parseLine( 'send-community extended', at_eol).map( isTrue )
const nextHopSelf					= parseLine( 'next-hop-self').map( isTrue ) 
const routeMapIn					= parseLine( 'route-map', routeMapName, 'in' ).map( _2 )
const routeMapOut					= parseLine( 'route-map', routeMapName, 'out' ).map( _2 )
	
// wildcard line-items
const unknown 							= parseLine(rol).map( _0 )
		
		
/** multi-level record parsers **/
		
const bgpNeighborRecord = until(endOfIndentLevel, sequenceOf(
	neighborHeader,	
	setOf(
		localAs.tag('localAS'),
		description.tag('desc'),
		isShutdown.tag('isShut'),
		timers.tag('timers'),
		until(endOfIndentLevel, sequenceOf(
			af_ipv4_unicast,
			setOf(
				sendCommunity.tag('sendCommunity'),
				sendCommunityExt.tag('sendCommunityExt'),
				routeMapIn.tag('routeMapIn'),
				routeMapOut.tag('routeMapOut'),	
				nextHopSelf.tag('nextHopSelf'),
				unknown.tag('neighbor-UNK-configline')
					.logResult(`[${pmodule.name}]:'bgpNeighborRecord': unknown information after network statement`)
			)		// setOf
		))	// until
	)  // setOf
)).named('bgpNeighborRecord')  // until
		
		
const bgpVrfRecord = until(endOfIndentLevel, sequenceOf(
	vrfHeader.tag('vrfName'),
	setOf(
		routerID.tag('routerId'),
		logNeighborChanges.tag('logNeighChanges'),
		until(endOfIndentLevel, sequenceOf(
			af_ipv4_unicast,
			many(network).map(joinWith('|')).tag('networks')
		))
	),
	many(bgpNeighborRecord).tagList('bgpPeers')
)).named('bgpVrfRecord')
//.getTagged()
//.map(multiplyBy('bgpPeers'))
	
/** NOTE: for .getTagged() and .map(multipyBy('bgpPeers'),
	 * Do this at the end, not here when dealing with nested lists of lists,
	 * as they should be 'unrolled' at the main parser(see the end of bgpMain)
	 */ 
	
	
const bgpMain = sequenceOf(
	hostnameFromConfig.tagAs('deviceName'),
	gotoSection('router bgp'),
	bgpHeader.tag('asn'),
	setOf(
		af_ipv4_unicast.tag('af'),
		parseLine('stuff2').map( _0 ).tag('somestuff1'),
		parseLine('stuff').map( _0 ).tag('somestuff2'),
	),
	many(bgpVrfRecord).tagList('vrfs')
).named(pmodule.name)
	.getTaggedR()
	.map(multiplyBy('vrfs'))					// <-- after this, we have an array, so next multiply is a mapArray
	.map(mapArray(multiplyBy('bgpPeers')))
	.map(flattenArray)
	
		
return bgpMain
		
}) ()
		
	

// use this in the browser, and comment out the imports/exports
// nxos_cfg_bgp_peers

// use this when using modules, and comment out the statement 'nxos_cfg_bgp_peers' above:
export default nxos_cfg_bgp_peers