/**  WHERE I"M AT:
I may have gotten this working, without re-using old stuff.  Refine and test more scenarios.

The main routine at the bottom is only hanlding a single ACL right now on purpose, so I can test 
every ACL line format for the extended parser.

The only problem is figuring out how to handle this extended acl line:

110 deny any log  (here, the 'any' is in the protocol position, not src or dst.  Thus src and dst
are actually optional).

The parser has been re-written to hanlde the fact that the src & test portionl are within a
"possibly" parser, but it doesn't seem to work.
 */


/**	Comment out this import and export at bottom when using in browser sandbox		 */


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
	groupByPropName,
	normalizedDataSet,
	nullToStr,
	pipe,
	asBoolean,
	bifurcateArray,

	// from Parser_Core.mjs
	endOfInput,
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
	tok,
	maybe,


	// from Parser_Text.mjs
	parseLine,
	letters,
	word,
	digits,
	rol,
	hword,
	at_eol,
	eol,
	colon,

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	ipNetworkOrAddress,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
	multiplyBy_v2_lossy,
	interfaceName,

	// Parser_Result_Helpers.mjs
	
	// from classIPv4.mjs
	IPv4,
	RoutingTable,
	ASN,


} from '../parser_modules.mjs'



/****************************************************************************
* module: 			arista_cfg_bgpPeers (v2 output)
*	description:	parses the output of a single Arista switches BGP section (specifically the peers)
*	output:				table containing the following:
*
*      deviceASN:					the ASN of the switch
*      peerIP: 						BGP neighbor IP
*      peerAS: 					the neighbors ASN,
*      description: 			neighbor description ,
*      bgpNeighLocalAs: 	local AS of this peer, along with any local-as flags (no-prepend, replace-as, etc),
*      timers: 						BGP timers <hello:holddown>,
*      routeMap_in: 				inbound route-map name,
*      routeMap_out: 			outbound route-map name 
*/
const get_eoscfg_bgp_peers  = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_bgp_peers',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}


	/****** BGP intra-line parser helpers  ******/
	const peerGroup = hword
	const routeMapName = hword
	const maxRoutes = digits
	const asplain = digits
	const asdot	=	sequenceOf([digits, strng('.'), digits]).map( ([left, , right]) => `${left}.${right}` )
	const asn = oneOf( asdot, asplain )
	const vrfName = hword
	
	// intra-line 
	const neighbor = oneOf(
		seqOf('neighbor', ipUC),
		seqOf('neighbor', hword)
	)
	
	// capture all possible options after the 'network' statement (more refinement is needed - route maps?)
	const networkOpts = oneOf(
		everythingUntil (eol),
	)
	
	// capture all possible options after the 'aggregate-address' statement
	const aggregateOptions = oneOf(
		seqOf ('attribute-map', routeMapName).map( ([_, routeMap]) => `attributeMap=${routeMap}` ),
		'advertise-only',
		everythingUntil (eol),
	)
	
	// route-target types go here, evpn is another one not listed yet...
	const routeTargetType = oneOf(
		strng('vpn-ipv4'),
	)
	
	// route target formats - not that there are other formats - expand when needed
	const routeTarget = sequenceOf([digits, colon, digits ]).map( ([left, _, right])=>`${left}:${right}` )
	
	
	/****** BGP line parsers  ******/
	
	// global BGP line parsers
	const bgpGlobal_header 						= parseLine ( 'router bgp', asn ).map( ([$1, deviceASN]) => ({deviceASN}) )
	const bgpGlobal_asDot 						= parseLine ( 'bgp', 'asn', 'notation', 'asdot' ).map( (result) => true ) 
	const bgpGlobal_asPlain 					= parseLine ( 'bgp', 'asn', 'notation', 'asplain' ).map( (result) => true )
	const bgpGlobal_routerID 					= parseLine ( 'router-id', 	ipAddress ).map( (result) => result[1] )
	const bgpGlobal_distance 					= parseLine ( 'distance bgp', digits, digits, digits ).map( ([ $1, d1, d2, d3 ]) => `${d1}:${d2}:${d3}` )
	const bgpGlobal_maxPath 					= parseLine ( 'maximum-paths', digits, 'ecmp', 	digits ).map( ([ $1, maxPaths, $3, maxPathsECMP ]) => `${maxPaths} / ECMP:${maxPathsECMP}` )
	const bgpGlobal_update_wait_install					= parseLine ( 'update wait-install' ).map( (result) => true )
	const bgpGlobal_additional_paths_policy 		= parseLine ( 'bgp additional-paths', hword).map( ([$1, policy]) => policy )
	const bgpGlobal_missing_policy_direction_in	= parseLine ( 'bgp missing-policy direction in action', hword ).map( ([$1, action]) => action )
	const bgpGlobal_missing_policy_direction_out= parseLine ( 'bgp missing-policy direction out action', hword ).map( ([$1, action]) => action )
	
	const bgpPeerGroup_peerAS = parseLine( 'neighbor', peerGroup, 'remote-as', asn ).map( ([$1, peerGroup, $3, peerAS]) => ({peerGroup, peerAS}) )
	
	// neighbor line parsers
	const bgpNeigh_localAS = parseLine( neighbor, 'local-as', asn, possibly(strng('no-prepend')), possibly(strng('replace-as')), rol)
		.map( ([$1, $2, localAS, noPrepend, replaceAS, rest_of_line]) => `${localAS} (${[noPrepend, replaceAS, rest_of_line].filter((x)=>x).join(',')})` )

	// most common
	const bgpNeigh_desc 									= parseLine( neighbor, 'description', rol ).map((result)=>result[2])
	const bgpNeigh_timers 								= parseLine( neighbor, 'timers', digits, digits ).map( ([$1, $2, keepAlive, holdDown ]) => `${keepAlive}:${holdDown}` )
	const bgpNeigh_routeMap_in 						= parseLine( neighbor, 'route-map', routeMapName, 'in'	).map((result)=>result[2])
	const bgpNeigh_routeMap_out 					= parseLine( neighbor, 'route-map', routeMapName, 'out' ).map((result)=>result[2])
	const bgpNeigh_maxRoutes 							= parseLine( neighbor, 'maximum-routes', rol ).map((result)=>result[2])
	const bgpNeigh_idleRestartTimer 			= parseLine( neighbor, 'idle-restart-timer', digits ).map( ([$1, $2, seconds]) => seconds )
	const bgpNeigh_update_source 					= parseLine( neighbor, 'update-source', interfaceName).map((result)=>result[2])
	const bgpNeigh_allowAS_in			 				= parseLine( neighbor, 'allowas-in', digits	).map( ([$1, $2, asnCount]) => asnCount )

	// flag values - the existence of the text provided means true - semantics are worked out in later map commands after parsing
	const bgpNeigh_has_sendCommunity			= parseLine( neighbor, 'send-community' ).map((result)=>true)
	const bgpNeigh_has_shutdown 					= parseLine( neighbor, 'shutdown' ).map((result)=>true)
	const bgpNeigh_has_nhs 								= parseLine( neighbor, 'next-hop-self' ).map((result)=>true)
	const bgpNeigh_has_remove_private_as 	= parseLine( neighbor, 'remove-private-as'	).map((result)=>true)
	const bgpNeigh_has_passwd 						= parseLine( neighbor, 'password' ).map((result)=>true)
	const bgpNeigh_has_bfd 								=	parseLine( neighbor, 'bfd').map((result)=>true)
	const bgpNeigh_has_fallover 					=	parseLine( neighbor, 'fall-over bfd' ).map((result)=>true)
	const bgpNeigh_has_default_originate 	= parseLine( neighbor, 'default-originate').map((result)=>true)
	const bgpNeigh_has_enforce_first_as		= parseLine( neighbor, 'enforce-first-as'	).map((result)=>true)
	const bgpNeigh_has_no_allowAs_in			= parseLine( 'no', neighbor, 'allowas-in'	).map( (result) => true )
	const bgpNeigh_has_no_gr							= parseLine( 'no', neighbor, 'graceful-restart'	).map((result)=>true)
	const bgpNeigh_has_no_shutdown				= parseLine( 'no', neighbor, 'shutdown').map((result)=>true)
	const bgpNeigh_has_no_enforce_first_as= parseLine( 'no', neighbor, 'enforce-first-as'	).map((result)=>true)	
	const bgpNeigh_has_no_additional_paths= parseLine( 'no', neighbor , 'additional-paths receive').map((result)=>true)	

	const bgpNeigh_metric_out							= parseLine( neighbor, 'metric-out', digits).map((result)=>result[2])
	const bgpNeigh_ebgp_multihop					=	parseLine( neighbor, 'ebgp-multihop', digits).map((result)=>result[2])
	
	// bgp network
	const bgpNetwork 									= parseLine ('network', ipNetwork, everythingUntil(eol) ).map( ([_, bgpNetwork, opt1, opt2 ]) => ({bgpNetwork, opt1, opt2 }) )
	
	// aggregate line parser(s)
	const bgpAggregateAddress 				= parseLine ('aggregate-address', ipNetwork, aggregateOptions, aggregateOptions ).map( ([_, aggregate, opt1, opt2 ]) => ({aggregate, opt1, opt2 }) )
	// redistribution line parsers
	const redistConnected_standard 		= parseLine ('redistribute connected route-map CONNECTED-TO-BGP').map( (res) => `CONNECTED-TO-BGP_exists` )
	const redistConnected_violation 	= parseLine ('redistribute connected', everythingUntil(eol) ).map( (res) => `VIOLATION(redistribute_connected): ${res[1]}`)
	const redistStatic_standard 			= parseLine ('redistribute static route-map STATIC-TO-BGP').map( (res) => `STATIC-TO-BGP_exists`)
	const redistStatic_violation 			= parseLine ('redistribute static',	everythingUntil(eol)).map( (res) => `VIOLATION(redistribute_static): ${res[1]}`)
	const redistViolation							= parseLine ('redistribute', everythingUntil(eol) ).map( (res) => `VIOLATION(other): redistribute ${res[1]} is used`)
	// vrf line parsers
	const bgpVRF_header 							= parseLine ('vrf', vrfName).map( ([_, vrfName]) => vrfName  )
	const bgpVRF_rd_type1 						= parseLine ('rd', sequenceOf([ digits, colon, digits ]) ).map( ([_, [left, __, right ] ]) => `${left}:${right}`)
	const bgpVRF_rd_type2 						= parseLine ('rd', sequenceOf([ ipAddress, colon, digits ]) ).map( ([_, [left, __, right ] ]) => `${left}:${right}`)
	const bgpVRF_routeTarget_in 			= parseLine ('route-target import', routeTargetType, routeTarget).map( ([_, rt_type, rt_toImport ]) => `${rt_toImport}(${rt_type})`)
	const bgpVRF_routeTarget_out 			= parseLine ('route-target export', routeTargetType, routeTarget).map( ([_, rt_type, rt_toExport ]) => `${rt_toExport}(${rt_type})`)
	const bgpVRF_routeTarget_out_RM 	= parseLine ('route-target export', routeTargetType, 'route-map', routeMapName).map( ([$1, rt_type, $3, exportRouteMap ]) => `${exportRouteMap}(route-map)`)
	const bgpVRF_routeTarget_in_RM	  = parseLine ('route-target import', routeTargetType, 'route-map', routeMapName).map( ([$1, rt_type, $3, importRouteMap ]) => `${importRouteMap}(route-map)`)
	
	// default line parser / unrecognized
	const unknown 									=	parseLine (everythingUntil(eol)).map((res) => res[0])
	
	
	/*** BGP line parsers data tagging ****/
	
	// tagging for global config lines
	const bgpGlobal_param = oneOf(
		bgpGlobal_asDot.tag('usesAsDot'),
		bgpGlobal_asPlain.tag('usesAsPlain'),
		bgpGlobal_routerID.tag('routerID'),
		bgpGlobal_distance.tag('distance'),
		bgpGlobal_maxPath.tag('maxPath'),
		bgpGlobal_update_wait_install.tag('update_wait_install'),
		bgpGlobal_additional_paths_policy.tag('bgp_additional_paths_policy'),
		bgpGlobal_missing_policy_direction_in.tag('bgp_missing_policy_IN'),
		bgpGlobal_missing_policy_direction_out.tag('bgp_missing_policy_OUT'),
		unknown.log('UNK_bgpGlobal_param').tag('UNK_bgpGlobal_param')
	)
	
	// tagging for global config lines
	const bgpVRF_param = oneOf(
		bgpGlobal_routerID.tag('routerID'),
		bgpGlobal_distance.tag('distance'),
		bgpGlobal_maxPath.tag('maxPath'),
		bgpGlobal_update_wait_install.tag('update_wait_install'),
		bgpGlobal_additional_paths_policy.tag('bgp_additional_paths_policy'),
		bgpGlobal_missing_policy_direction_in.tag('bgp_missing_policy_IN'),
		bgpGlobal_missing_policy_direction_out.tag('bgp_missing_policy_OUT'),
		unknown.log('UNK_bgpVRF_param').tag('UNK_bgpVRF_param')
	)
	

	// tagging for neighbor lines
	const bgpPeer_param = oneOf(
		bgpPeerGroup_peerAS.tag('bgpPeerGroup_peerAS'),
		bgpNeigh_desc.tag('desc'),
		bgpNeigh_ebgp_multihop.tag('ebgp_multihop'),
		bgpNeigh_maxRoutes.tag('maximum_routes'),
		bgpNeigh_has_sendCommunity.tag('has_sendCommunity'),
		bgpNeigh_has_bfd.tag('uses_bfd'),
		bgpNeigh_has_default_originate.tag('default_originate'),
		bgpNeigh_has_enforce_first_as.tag('enforce_first_as'),
		bgpNeigh_has_fallover.tag('uses_fallover'),
		bgpNeigh_has_nhs.tag('nextHopSelf'),
		bgpNeigh_has_nhs.tag('uses_nhs'),
		bgpNeigh_has_no_additional_paths.tag('additional_paths'),
		bgpNeigh_has_no_allowAs_in.tag('disabled'),
		bgpNeigh_has_no_enforce_first_as.tag('enforce_first_as'), 
		bgpNeigh_has_no_gr.tag('graceful_restart'),
		bgpNeigh_has_no_shutdown.tag('has_noshutdown'),
		bgpNeigh_has_passwd.tag('uses_passwd'),
		bgpNeigh_has_remove_private_as.tag('uses_remove_private_as'),
		bgpNeigh_has_shutdown.tag('is_shutdown'),
		bgpNeigh_idleRestartTimer.tag('idleRestartTimer'),
		bgpNeigh_allowAS_in.tag('allowAs_in'),
		bgpNeigh_localAS.tag('localAS'),
		bgpNeigh_metric_out.tag('metric_out'),
		bgpNeigh_routeMap_in.tag('routeMap_in'),
		bgpNeigh_routeMap_out.tag('routeMap_out'),
		bgpNeigh_timers.tag('timers'),
		bgpNeigh_update_source.tag('update_source'),
		unknown.log('UNK_bgpPeer_param').tag('UNK_bgpPeer_param')
	)
		
	
	/**** BGP redistribution statement types ****/
	const redistributionStatement = oneOf(
		redistConnected_standard,
		redistStatic_standard,
		redistConnected_violation,
		redistStatic_violation,
		redistViolation,
	)
	
	// route-distinguisher text formats:  
	const bgpVRF_rd = oneOf(
		bgpVRF_rd_type1,						//	<ipv4>:<16bit>
		bgpVRF_rd_type2,						//	<16bit>:<16bit>
	)

	
	// the start of a peer template (peer group) configuration
	const bgpPeerGroup_header = parseLine ( 'neighbor', peerGroup, 'peer group')
		.map( ([$1, peerGroupName, $3, peerAS]) 	=>	({peerGroupName, peerAS }) )
		
	// the start of a peer IP (neighbor) configuration, **** WITH references to a peer-group *** , so it's assumed to need further resolution with peer-group parameters
	const bgpPeerIP_header_unresolved = parseLine ( 'neighbor', ipAddress, oneOf('peer group', 'peer-group'), peerGroup )
		.map( ([ $1, peerIP, $3, peerGroup]) => ({peerType: 'unresolved',	peerIP,	peerGroup	}))
	
	// the start of a peer IP (neighbor) configuration, **** WITHOUT references to a peer-group *** 
	const bgpPeerIP_header_resolved = parseLine ( 'neighbor', ipAddress, 'remote-as', asn )
		.map( ([$1, peerIP, $3, peerAS]) 	=>	({ peerType: 'resolved', peerIP, peerAS }))
	
	const bgpPeerIP_header = oneOf(
		bgpPeerIP_header_unresolved,
		bgpPeerIP_header_resolved,
	)
	
	
	/**** BGP neighbor parser (works for global & VRFs ) ****/
	
	// this is how we know we're done parsing multiple lines for a single neighbor  (there is no simple delimiter separating neighbors)
	// **key assumption** : befcause we're matching 'endOfInput', this should only be used within a sub-parser such as 'parseSection'
	const bgpPeerIP_delimiters = oneOf(
		bgpPeerIP_header,
		bgpNetwork,										// neighbor ends when next line is like 'network' statement
		bgpAggregateAddress,					// neighbor ends when next line is like 'aggregate-address' statement
		redistributionStatement,			// neighbor ends when next line is like 'redistribute ...' statement
		endOfInput,										// neighbor ends when we're at the end of a section input 
	)
	
	// used with bgpPeerGroup to help delimit bgpPeerGroups.
	const bgpPeerGroup_delimiters = oneOf(
		bgpPeerGroup_header,										// another peer-group terminates the previous one
		parseLine( 'neighbor', ipAddress ),			// also, any neighbor <ipAddress> statement terminates the a bgp peer-group
	)
	
	
	/**** BGP per-vrf parser ****/
	
	const bgpVRF_routeTarget_in_types = oneOf(
		bgpVRF_routeTarget_in,
		bgpVRF_routeTarget_in_RM,
	)
	
	const bgpVRF_routeTarget_out_types = oneOf(
		bgpVRF_routeTarget_out,
		bgpVRF_routeTarget_out_RM,
	)
	
	const vrfConfig = seqOf(
		bgpVRF_header.tag('vrfName'),
		possibly(bgpVRF_rd).map(nullToStr).tag('rd'),
		many (bgpVRF_routeTarget_in_types).map( (rts)=>rts.join(', ') ).tag('routeTargets_in')	,
		many (bgpVRF_routeTarget_out_types).map( (rts)=>rts.join(', ') ).tag('routeTargets_out'),
	).getTaggedR()
	
	// parses all remaining lines in a VRF 
	const vrfParams = seqOf(
		vrfConfig,
		until(bgpPeerIP_delimiters, 
			many(bgpVRF_param).getTaggedR()
		)
	).map(flattenItem)
	
	
	/**** BGP peer-group parser ****/
	
	// parses all lines relevent to a single BGP peer group, and merges results into a single bgp peer template record
	const bgpPeerGroup = seqOf(
		bgpPeerGroup_header,															//  'neighbor', peerGroup, 'peer group'
		until( bgpPeerGroup_delimiters, 
			many( bgpPeer_param).getTaggedR(),
		).map(flattenItem)
	).map(flattenItem)
	
	
	/**** BGP peer-IP parser ****/
	
	// parses all lines relevent to a single BGP neighbor, and merges results into a single bgp peer record
	const bgpPeerIP =	seqOf(
		bgpPeerIP_header,
		until(bgpPeerIP_delimiters,
			many(bgpPeer_param).getTaggedR()
		)
	).map(flattenItem)
	
	
	
	/**** BGP Section Parsers ****/
	
	/**	globalSection - parses the entire BGP global section (up to, but not including, VRFs), and returns the following:
			Returns: {
				peerTemplates,
				globalPeers
			}
		*/
	const globalSection = parseSection(
		seqOf(
	
			// 1) bgp global, non-peer items
			seqOf(
				bgpGlobal_header,
				until(bgpPeerGroup_delimiters, 
					many(bgpGlobal_param).getTagged()
				)
			).map(flattenItem).tag('bgpGlobals'),
	
			// 2) bgp peer-group items
			many(bgpPeerGroup).tagList('peerTemplates'),
	
			// 3) bgp peer IP items
			many(bgpPeerIP).tagList('globalPeers'),
	
		).getTaggedR()
			.map( ({ bgpGlobals, peerTemplates, globalPeers }) => ({ 
				peerTemplates, 
				globalPeers: globalPeers.map( (item) => ({				// global peers need a vrfName and global parameters inserted...
					//
					vrfName:'', 
					...bgpGlobals, 
					...item, 
				}) ) 		// array map
			}))
	)
	
	const vrfSection = 	parseSection(
		seqOf(
			vrfParams.tag('vrfConfig'),
			many(bgpPeerIP).tagList('vrfPeers'),
		).getTaggedR().map(flattenItem)
	).map(multiplyBy_v2_lossy('vrfPeers'))
		.map(flattenArray)
	
	/*** OUTPUT FUNCTIONS ***/

	// Step 1 in the post-processing pipeline - just get the data to the right shape
	const toPeerRecords = ({
		globalBGP: {
			deviceASN = "really_handle_this",
			routerID = '',
			bgpPeerTemplates = [],
			bgpPeerIPs = [],
			aggregateAddresses = [],
			redistributeConnected,
			redistributeStatic,
			...skipped_globalBGP_config
		},
		vrfs,
	}={}) => ({
		bgpPeerTemplates,
		global_bgpPeers: bgpPeerIPs.map( (bgpPeer) => ({vrfName:'default', deviceASN:asn, routerID, ...bgpPeer})),
		vrf_bgpPeers: vrfs.map(multiplyBy('bgpPeers')).flat().map(flattenItem).map( (bgpPeer) => ({deviceASN:asn, ...bgpPeer}) ),
		bgpPeerIPs: [...bgpPeerIPs.map( (bgpPeer) => ({vrfName:'default', deviceASN:asn, routerID, ...bgpPeer})), ...vrfs.map(multiplyBy('bgpPeers')).flat().map(flattenItem).map( (bgpPeer) => ({deviceASN:asn, ...bgpPeer}) )]
	})


	// Step 2 - add a unique key to each record (by deviceName:vrfName:peerIP) because we are re-using BGP peer IPs across VRFs per device!!
	const addUniqueKey = ({peerIP, vrfName, ...peer	}) => ({
		_key_: `${deviceName}:${vrfName}:${peerIP}`,
		peerIP, 
		vrfName, 
		...peer
	})


	// Step 3 - resolve any peer IPs which reference a peer-group (it was important to have the unique key _key_ for this as well...)	
	const resolvePeers = ({ bgpPeerTemplates, bgpPeerIPs }) => {
		// split the peerIP records by whether they have a peerTemplate attribute or not - those that do require resolving
		const [resolvedPeerIPs, unresolvedPeerIPs] = bifurcateArray((bgpPeerIP) => bgpPeerIP.peerGroup==null|| bgpPeerIP.peerGroup=='') (bgpPeerIPs)

		// create a template lookup database, keyed by peerGroupName.  This will be used to iterate over unresolvedPeerIPs so we can add peer-group info to them
		const templateCache = new Map()
		bgpPeerTemplates.map((template) => { templateCache.set(template.peerGroupName, template) })

		// we're keeping track of peerIPs that are not peer-group members (thus resolved by default) and also those that we resolve via lookup
		const resolvedPeerCache = new Map()

		// using the templateCache, resolve each bgpPeer in the unresolved list, by looking up the peer's peerGroup, and applying template attributes to them
		const newlyResolvedPeerIPs = unresolvedPeerIPs.map( (unresolvedPeerIP) => ({
			...templateCache.get(unresolvedPeerIP.peerGroup), 			// retrieve the peer-group data for the peerIP...
			...unresolvedPeerIP, 																			// merge with unresolved data (these props replaced template props)
			peerGroup_notes: 'resolved_resolvePeers'				// change peerType for informational/troubleshooting purposes  			
		}))

		// builds a resolved neighbor cache, where the key is the neighbor IP address (peer is an IP address string)
		// yes - .map is used and it should be for, but should be OK
		newlyResolvedPeerIPs.map((newlyResolvedPeerIP) => {
			resolvedPeerCache.set(newlyResolvedPeerIP._key_, newlyResolvedPeerIP)
		})

		// This is the part of the code that is messy, to handle for duplicate peer IPs between 'resolved', and 'unresolved'
		// add 'resolved' to the newResolved map.  There could be duplicates (which is why we're bothering with a Map data structure in the first place for ).
		resolvedPeerIPs.map((peer) => {

			if (resolvedPeerCache.has(peer._key_)) {
				const duplicatePeer = resolvedPeerCache.get(peer._key_)
				const fullyResolvedPeer = { ...duplicatePeer, ...peer }
				resolvedPeerCache.set(peer._key_, fullyResolvedPeer)
			}
			else {
				resolvedPeerCache.set(peer._key_, peer)
			}
		})

		return [...resolvedPeerCache.values()]
	}


	// Step 4: normalize ASNs to asplain, because we will use ASNs to map devices
	const normalizedASN = (asn='') => asn.includes('.') ? `${(ASN.from_asDot(asn).error || ASN.from_asDot(asn).asn)}` : asn
	const normalizedASNs =  ({
		deviceASN,
		peerAS,
		localAS,
		...bgpPeerRecord
	}) => ({
		deviceASN,
		peerAS,
		localAS,
		deviceASN_asplain: normalizedASN(deviceASN),
		peerAS_asplain: normalizedASN(peerAS),
		localAS_asplain: normalizedASN(localAS),
		...bgpPeerRecord,
	})


	// this maps each bgpPeer record so that the fields displayed in the right order
	const formatColumns = ({
		vrfName,
		peerIP,
		deviceASN,
		peerAS,
		localAS,
		deviceASN_asplain,
		peerAS_asplain,
		localAS_asplain,
		peerType,
		peerGroup,
		peerGroup_notes,
		desc,
		routeMap_in,
		routeMap_out,
		has_sendCommunity,		
		maximum_routes,
		routeTargets_in,
		routeTargets_out,
		usesAsDot,
		routerID,
		rd,
		distance,
		maxPath,
		uses_bfd,
		timers,
		vrfPeers,
		peerTemplate,
		is_shutdown,
		has_noshutdown,
		UNK_bgpVRF_param,
		UNK_bgpPeer_param,

		nextHopSelf,
		_key_,
		...skipped
	}) => ({
		deviceName,
		vrfName: (vrfName=="") ? 'default' : vrfName,
		peerIP,
		peerType: (deviceASN == peerAS ) ? 'iBGP' : 'eBGP',
		adminDown: (is_shutdown) ? true :  (has_noshutdown) ? false : false,
		deviceASN,
		peerAS,
		localAS,
		routeMap_in,
		routeMap_out,
		has_sendCommunity,
		routerID,
		rd,
		desc,
		peerGroup,
		deviceASN_asplain,
		peerAS_asplain,
		localAS_asplain,
		routeTargets_in,
		routeTargets_out,
		// maximum_routes,
		//usesAsDot,
		//distance,
		//maxPath,
		//uses_bfd,
		//timers,
		//UNK_bgpVRF_param,
		//UNK_bgpPeer_param,

		nextHopSelf,
		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})
	


	/**** Main parser ****/
	
	return seqOf(
		// advance through config up to (but not including) the 'router bgp' section
		gotoSection ('router bgp'),
		globalSection.tag('globals'),
		many(vrfSection).map(flattenArray).tagList('vrfPeers'),
	).getTaggedR()
		// pull peerTemplates out from under global, and then combine global and vrf peers for a final list of peers
		.map( ({ 
			globals: { 
				peerTemplates: bgpPeerTemplates, 
				globalPeers 
			}, 
			vrfPeers 
		}) => ({
			bgpPeerTemplates, 
			bgpPeerIPs: [...globalPeers.map(({...globalPeer}) => ({...globalPeer, vrfName:'default'})), ...vrfPeers]
		}))
		.map( ({bgpPeerIPs, ...rest})=>({bgpPeerIPs: bgpPeerIPs.map(addUniqueKey), ...rest}))
		.map(resolvePeers)
		.map(mapArray(normalizedASNs))
		.map(mapArray(formatColumns))
}
	
// comment this out when using in production
// get_eoscfg_bgp_peers ('test_device_name')
	
	

// comment this out when using in-browser IDE
export { get_eoscfg_bgp_peers }



