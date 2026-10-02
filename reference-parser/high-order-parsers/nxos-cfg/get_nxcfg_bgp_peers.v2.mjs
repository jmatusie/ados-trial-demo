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
	ifNotFound,

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
* module: 			get_nxcfg_bgp_peers
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



const get_nxcfg_bgp_peers_v2 = (deviceName) => {

	const pmodule = {
		name: 'get_nxcfg_bgp_peers',
		ver: 2.0
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

	// headers
	const bgpHeader 					= parseLine( 'router bgp', asn ).map( _1 )
	const vrfHeader						= parseLine( 'vrf', vrfName ).map( _1 )

	// raw line parsers for nxos bgp
	const af_ipv4_unicast 		= parseLine( 'address-family', 'ipv4', 'unicast' ).map( isTrue )
	const af_ipv4_multicast 	= parseLine( 'address-family', 'ipv4', 'multicast' ).map( isTrue )
	const af_other 						= parseLine( 'address-family', hword, rol ).map( isTrue )

	// bgp parameters (global and vrf)
	const routerID						= parseLine( 'router-id', ipUC ).map( _1 )
	const logNeighborChanges 	= parseLine( 'log-neighbor-changes' ).map( isTrue )

	// under 'address-family ipv4 unicast' lines
	//const network							= parseLine( 'network', ipNetwork, at_eol).map( _1 )
	//const network_plus				= parseLine( 'network', ipNetwork, rol)
	const network 						= parseLine( 'network ', ipNetwork.tag('network'), possibly(seqOf('route-map', hword.tag('route_map'))))
	const network_other				= parseLine( 'network', ipNetwork.tag('network'), rol.tag('UNK_network'))
		.logResult((res) => `[${pmodule.name}:network_other] unknown statement after 'network': '${res}'`)	
		

	// under 'neighbor -> address-family ipv4 unicast' lines
	const nextHopSelf					= parseLine( 'next-hop-self').map( isTrue ) 
	const routeMapIn					= parseLine( 'route-map', routeMapName, 'in' ).map( _1 )
	const routeMapOut					= parseLine( 'route-map', routeMapName, 'out' ).map( _1 )
	

	// peer parameters - main 
	const remoteAs 						= parseLine( 'remote-as', asn.tag('peerAS'))
	const localAs							= parseLine( 'local-as', asn, rol ).map( ([_0, asn, flags=``]) => ({localAs:asn, localAS_flags:flags }) )
	const neighborHeader 			= parseLine( 'neighbor', ipUC.tag('peerIP'), possibly(seqOf('remote-as', asn.tag('peerAS')).map(ifNotFound('')) ))

	const inheritPeer					= parseLine( 'inherit peer', hword).map( _1 )
	const inheritPeerSession	= parseLine( 'inherit peer-session', hword).map( _1 )

	// peer parameters - ancillary
	const description					= parseLine( 'description', rol ).map( _1 )
	const sessionTimers 			= parseLine( 'timers', timerSeconds, timerSeconds ).map( ([_,_1,_2])=>`${_1}:${_2}` )
	const capability 					= parseLine( 'capability', rol).map(res=>res[1])
	const maxPrefix						= parseLine( 'maximum-prefix', digits).map( _1 )
	// peer parameters - flags
	const peerPassword				= parseLine( 'password', rol).map( isTrue )
	const bfdPeer 						= parseLine( 'bfd', at_eol).map( isTrue )
	const removePrivateAS			= parseLine( 'remove-private-as').map( isTrue )
	const isShutdown					= parseLine( 'shutdown' ).map( isTrue )
	const isNoShutdown				= parseLine( 'no shutdown' ).map( isTrue )
	const sendCommunity				= parseLine( 'send-community', at_eol).map( isTrue )
	const sendCommunityExt		= parseLine( 'send-community extended', at_eol).map( isTrue )

	// wildcard line-items
	const unknown 							= parseLine(rol).map( _0 )


	// peer statements under 'neighbor -> address family ipv4'
	const bgpPeerParameters_AF = setOf(
		routeMapIn.tag('routeMap_in'),
		routeMapOut.tag('routeMap_out'),	
		nextHopSelf.tag('nextHopSelf'),
		unknown.tag('UNK_bgpPeerParameters_AF').logResult((res) => `[${pmodule.name}:bgpPeerParameters_AF] unknown statement: '${res}'`)
	)

	// inner-level address-family - per neighbor
	const addressFamily_peerLevel_ipv4_unicast = until(endOfIndentLevel, sequenceOf(
		af_ipv4_unicast.tag('is_af_ipv4_unicast'),
		bgpPeerParameters_AF,
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])
	.tag('is_af_ipv4_unicast')

	// inner-level address-family - per neighbor
	const addressFamily_peerLevel_ipv4_multicast = until(endOfIndentLevel, sequenceOf(
		af_ipv4_multicast.tag('is_af_ipv4_multicast'),
		bgpPeerParameters_AF,
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])

	// inner-level address-family - per neighbor
	const addressFamily_peerLevel_other = until(endOfIndentLevel, sequenceOf(
		af_other.tag('is_af_other'),
		bgpPeerParameters_AF,
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])

	// for peer statements *outside* the address-family
	const bgpPeerParameters = setOf(
		remoteAs,
		localAs,
		neighborHeader,
		addressFamily_peerLevel_ipv4_unicast,
		addressFamily_peerLevel_ipv4_multicast,
		inheritPeer.named('peerGroupPolicy'),
		inheritPeerSession.named('peerGroup'),
		description.tag('desc'),
		bfdPeer.tag('has_bfd'),
		removePrivateAS.tag('remove_prevate_as'),
		isShutdown.tag('is_shutdown'),
		isNoShutdown.tag('is_no_shutdown'),
		sessionTimers.tag('timers'),
		peerPassword.tag('peer_passwd'),
		capability.logResult( (res) => `[${pmodule.name}:bgpPeerParameter]: 'capability: ${res}' was found but not included in results` ),
		sendCommunity.tag('has_send_community'),
		sendCommunityExt.tag('has_send_communityExt'),
		maxPrefix.tag('max-prefix'),
		addressFamily_peerLevel_other,
		unknown.tag('UNK_bgpPeerParameter').logResult((res) => `[${pmodule.name}:bgpPeerParameter] unknown statement: '${res}'`),
	)


	const peerRecord = until(endOfIndentLevel, sequenceOf(
		neighborHeader,
		possibly(addressFamily_peerLevel_ipv4_unicast),
		possibly(bgpPeerParameters),
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])

	// outer-level address-family - not per neighbor
	const addressFamily_nodeLevel_ipv4_unicast = until(endOfIndentLevel, sequenceOf(
		af_ipv4_unicast.tag('is_af_ipv4_unicast'),
		possibly(
			setOf(
				many(network).tagList('networkStatements'),//.tag('af_ipv4_unicast_networks'),
				unknown.tag('UNK_addressFamily_nodeLevel_ipv4_unicast').logResult((res) => `[${pmodule.name}:addressFamily_nodeLevel_ipv4_unicast] unknown statement: '${res}'`)
			)
		)
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])

	// outer-level address-family - not per neighbor
	const addressFamily_nodeLevel_ipv4_multicast = until(endOfIndentLevel, sequenceOf(
		af_ipv4_multicast.tag('is_af_ipv4_multicast'),
		possibly(
			setOf(
				unknown.tag('UNK_addressFamily_nodeLevel_ipv4_multicast').logResult((res) => `[${pmodule.name}:addressFamily_nodeLevel_ipv4_multicast] unknown statement: '${res}'`),
			)
		)
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])

		// outer-level address-family - not per neighbor
	const addressFamily_nodeLevel_other = until(endOfIndentLevel, sequenceOf(
		af_other.tag('is_af_other'),
		possibly(
			setOf(
				unknown.tag('UNK_addressFamily_nodeLevel_other').logResult((res) => `[${pmodule.name}:addressFamily_nodeLevel_other] unknown statement: '${res}'`),
			)
		)
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])


	const addressFamily_nodeLevel = oneOf(
		addressFamily_nodeLevel_ipv4_unicast,
		addressFamily_nodeLevel_ipv4_multicast,
		addressFamily_nodeLevel_other
	)

	const bgpParameters = setOf(
		routerID.tag('routerID'),
		logNeighborChanges.tag('logNeighborChanges'),
	)

	const vrfRecord = until(endOfIndentLevel, sequenceOf(
		vrfHeader.tag('vrfName'),
		possibly(bgpParameters).tag('vrf_bgp_parameters'),
		many(addressFamily_nodeLevel).tagList('vrf_address_families'),
		//addressFamily_nodeLevel_ipv4_unicast.tag('vrf_af_node_ipv4_unicast'),
		many(peerRecord).tagList('vrf_peers')
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])
	//.getTaggedR()
	

	const peerTemplate = until(endOfIndentLevel, sequenceOf(
		parseLine('template peer-session', hword.tag('templateName')),
		bgpPeerParameters,
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])

	const peerPolicyTemplate = until(endOfIndentLevel, sequenceOf(
		parseLine('template peer-policy', hword.tag('policyTemplateName')),
		bgpPeerParameters,
	)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []])



	return sequenceOf(
		goto('\nrouter bgp'),
		parseLine(rol),

		// until end of entire BGP section
		until(endOfIndentLevel, sequenceOf(
			bgpHeader.tag('deviceASN'),
			possibly(bgpParameters),				// router-id, log-neighbor-changes, etc.
			many(addressFamily_nodeLevel).tagList('af_node_global'),			// ipv4 unicast (distance, network, aggregate-address, redistribute?), ipv4 multicast (distance), etc
			many(peerRecord).tagList('peers_global_2'),
			many(peerPolicyTemplate).tagList('peerPolicyTemplates'),
			many(peerTemplate).tagList('peerTemplates'),
			many(peerRecord).tagList('peers_global'),
			many(vrfRecord).tag('vrfs'),
		)).logEnv(({section_parser_dataLog})=>[...section_parser_dataLog?.flat() ?? []]),
	).getTaggedR()

	//.tapResult('nx-raw')
}



// get_nxcfg_bgp_peers('dummy')
// comment out in production:
// get_nxcfg_bgp_config_v2('testDevice')


// end of module nexus_cfg_bgp
export { get_nxcfg_bgp_peers_v2 }

