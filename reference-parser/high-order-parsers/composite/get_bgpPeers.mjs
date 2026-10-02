import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	intf_classifyBy,
	normalizedDataSet,
	coroutine,
	nullToObject,
	nullToArray,
	nullToStr,
	groupBy,
	groupByPropName,
	bifurcateArray,

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
	word,
	eol,
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
	// from classIPv4.mjs
	IPv4,
	RoutingTable,
	Parser,
	dedent,

} from '../parser_modules.mjs'




import { get_eoscfg_bgp_peers_v2 } from '../eos-cfg/get_eoscfg_bgp_peers_v2.mjs'
import { get_nxcfg_bgp_peers_v2 } from '../nxos-cfg/get_nxcfg_bgp_peers.v2.mjs'
import { get_nxcfg_bgp_peers } from '../nxos-cfg/get_nxcfg_bgp_peers.mjs'
import { get_ipInterfaces } from './get_ipInterfaces.mjs'
import { get_routeMaps_basic } from "./get_routeMaps_basic.mjs";



/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_bgpPeers',						// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}




// enhanced routeMaps
const get_bgpPeers = (deviceName, deviceOS) => coroutine(function* () {
	const dataLog = []

	//const ipInterfaces = yield possibly(lookAhead(get_ipInterfaces(deviceName))).map(nullToArray)
	//const routeMaps_basic = yield possibly(lookAhead(get_routeMaps_basic(deviceName))).map(nullToArray)
	//const eos_bgpPeers_v2 = yield possibly(lookAhead(get_eoscfg_bgp_peers_v2(deviceName))).map(nullToArray)

	const ipInterfaces = yield possibly(lookAhead(get_ipInterfaces(deviceName, deviceOS))).map(nullToArray)

	const routeMaps_basic = yield possibly(lookAhead(get_routeMaps_basic(deviceName, deviceOS))).map(nullToArray)

	const rawBgpPeers = 
	(deviceOS == 'EOS') ? yield possibly(lookAhead(get_eoscfg_bgp_peers_v2(deviceName))).map(nullToArray)
	: (deviceOS == 'NX-OS') ? yield possibly(lookAhead(get_nxcfg_bgp_peers(deviceName))).map(nullToArray)
	: null 

	if (rawBgpPeers == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	} 



	// create a lookup cache for this switch's ip interface records by name
	const ipInterfaces_lookup_byName = groupByPropName('interfaceName')(ipInterfaces)
	const routeMap_lookupMap = Map.groupBy(routeMaps_basic, (rmRecord) => rmRecord.routeMapName)


	// create a RoutingTable object of this switch's ipInterface routes, so we can resolve bgpPeer IPs to local interface names by doing
	//	a route lookup (i.e. if bgpPeer IP is a subnet of the routing table, get the matchign routing table's data entry (containing the interface name)
	//	then use the name to look up the ipInterface record.
	const ipInterfaces_asLookup = ipInterfaces.map(({ ip_addr, ip_masklen, interfaceName, vrf }) => new IPv4(`${ip_addr}/${ip_masklen}`)?.getNetwork()?.setData({ interfaceName, vrf })) ?? `[ipInterfaces_asLookup]:invalid_ip_address on interface ${name}`
	const localRt = new RoutingTable(ipInterfaces_asLookup)

	const resolveLocalInterface1 = (bgpPeerIP) => {
		const intf_name = localRt.longestMatch(bgpPeerIP)?.data?.interfaceName ?? null
		if (!intf_name) {

			// question: how to get log messages added to this script?  Below is my first attempt.
			dataLog.push(`${deviceName} [${pmodule.name}]: no local interface on the switch found relating to peer IP ${bgpPeerIP} - possible switch misconfiguration, or otherwise multihop is employed.`)
			// console.error(`[resolveLocalIntf]: no local interface on switch ${switchName} found relating to peer IP ${bgpPeerIP} - likely the result of a switch misconfiguration`, {switchName, bgpPeerIP, localRt, ipInterfaces} )
			return {
				localIntf_name: `ERROR (see desc)`,
				localIntf_ip: ``,
				localIntf_desc: `ERROR - cannot resolve local interface on '${deviceName}' for the bgp peer IP '${bgpPeerIP}'\nLikely the result of an incomplete configuration.  See error console for details`,
				localIntf_ipType: ``,
				localIntf_type: ``,
				localIntf_vlan: ``
			}		// end of failure object
		}	// end of early return due to failure
		const { interfaceName, ip_addr, desc, ip_masklen, ip_subnet, ipType, type, vlanTag } = ipInterfaces_lookup_byName[intf_name][0]
		return {
			localIntf_name: interfaceName,
			localIntf_ip: `${ip_addr}/${ip_masklen}`,
			localIntf_ip_subnet: ip_subnet,
			localIntf_desc: desc ?? '',
			localIntf_ipType: ipType,
			localIntf_type: type,
			localIntf_vlan: vlanTag,
		}		// end of success object
	}		// end of function


	const resolveLocalInterface2 = (bgpPeerIP, bgpPeerVRF, is_ebgpMultihop, peerType) => {
		const fnName = `resolveLocalInterface2`
		const matchingInterface = ipInterfaces.filter((ipInterface) => IPv4.of(ipInterface.ip_subnet).isSupernetOf(bgpPeerIP) && ipInterface.vrf == bgpPeerVRF)
		// failure case #1 - no interfaces match BGP peer subnet (then find out why)
		if (matchingInterface.length == 0) {
			const failureReason = is_ebgpMultihop ? `ebgp multi-hop`
				: peerType == 'iBGP' ? `iBGP peer not directly connected`
				: `misconfiguration of peer IP (likely)`

			const logMessage = `${deviceName}-4905: [${pmodule.name}:${fnName}]: Cannot resolve peer IP with interface on switch '${deviceName}' for peer '${bgpPeerIP}'. Reason: ${failureReason}`
			dataLog.push(logMessage)
							
					// console.error(`[resolveLocalIntf]: no local interface on switch ${switchName} found relating to peer IP ${bgpPeerIP} in vrf ${bgpPeerVRF}.  It is likely the result of a switch misconfiguration`, {switchName, bgpPeerIP, bgpPeerVRF, localRt, ipInterfaces} )
			return {
				intf_name: `unmatched (see intf_desc column)`,
				intf_ip: ``,
				intf_ip_subnet: ``,
				intf_desc: `Cannot resolve peer IP with interface on switch '${deviceName}' for peer '${bgpPeerIP}'. Reason: ${failureReason}`,
				intf_ipType: ``,
				intf_type: ``,
				intf_vlan: ``,
				intf_iplink: ``,
				intf_iplink_vrf: ``,
				intf_ip_acl_in: ``,
				intf_ip_acl_out: ``,
				intf_ip_mc_acl_out: ``,
				intf_ip_mc_acl: ``,
				intf_ip_pim_sparsemode: ``,
			}		// end of failure object
		}	// end of early return due to failure

		// failure case #2 - more than one interfaces match BGP peer subnet
		if (matchingInterface.length > 1) {
			const logMessage = dedent`
				${deviceName}: [${pmodule.name}:${fnName}]: Multiple local interfaces found associated to bgp peer IP ${bgpPeerIP} in vrf ${bgpPeerVRF}.  This is likely a scripting bug.  Details:
				  - ${ ipInterfaces.map( ({interfaceName,desc,vrf })=>`${interfaceName}:${desc}:${vrf}` ).join(':') }
			`
			dataLog.push(logMessage)
			console.error(logMessage)
			return {
				intf_name: `ERROR_2`,
				intf_ip: ``,
				intf_ip_subnet: ``,
				intf_desc: logMessage,
				intf_ipType: ``,
				intf_type: ``,
				intf_vlan: ``,
				intf_iplink: ``,
				intf_iplink_vrf: ``,
				intf_ip_acl_in: ``,
				intf_ip_acl_out: ``,
				intf_ip_mc_acl_out: ``,
				intf_ip_mc_acl: ``,
				intf_ip_pim_sparsemode: ``,
			}		// end of failure object
		}	// end of early return due to failure

		// ideal case - only a single matching local interface was found:
		//   pull only the interesting columns from the ipInterface table...
		const {
			interfaceName,
			adminDown,
			ip_addr,
			desc = '',
			ip_masklen,
			ip_subnet,
			iplink,
			iplink_vrf,
			ipType,
			type,
			vlanTag = '',
			ip_acl_in = '',
			ip_acl_out = '',
			ip_mc_acl_out = '',
			ip_mc_acl = '',
			ip_pim_sparsemode = '',
		} = matchingInterface[0]

		// rename the keys that were pulled...
		return {
			intf_name: interfaceName,
			intf_isShut: adminDown,
			intf_ip: `${ip_addr}/${ip_masklen}`,
			intf_ip_subnet: ip_subnet,
			intf_desc: desc,
			intf_ipType: ipType,
			intf_type: type,
			intf_vlan: vlanTag,
			intf_iplink: iplink,
			intf_iplink_vrf: iplink_vrf,
			intf_ip_acl_in: ip_acl_in,
			intf_ip_acl_out: ip_acl_out,
			intf_ip_mc_acl_out: ip_mc_acl_out,
			intf_ip_mc_acl: ip_mc_acl,
			intf_ip_pim_sparsemode: ip_pim_sparsemode,
			//			localIntf_ip:			`${ip_addr}/${ip_masklen}`,
		}		// end of success object
	}		// end of function


	const resolveLocalInterface = resolveLocalInterface2

	const mergeInterfaceData = ({
		peerIP,
		vrfName,
		peerType,
		is_ebgpMultihop,
		...rest
	}) => ({
		peerIP,
		vrfName,
		peerType,
		is_ebgpMultihop,
		...resolveLocalInterface(peerIP, vrfName, is_ebgpMultihop, peerType),
		...rest
	})

	const resolveLocalRouteMap = ({
		routeMap_in = '',
		routeMap_out = '',
		...rest
	}) => ({
		routeMap_in: !routeMap_in ? '' : routeMap_lookupMap.has(routeMap_in) ? routeMap_in : `MISCONFIG: route_map '${routeMap_in}' does not exist! on device`,
		routeMap_out: !routeMap_out ? '' : routeMap_lookupMap.has(routeMap_out) ? routeMap_out : `MISCONFIG: route_map '${routeMap_out}' does not exist! on device`,
		...rest
	})




	const formatColumns = ({
		deviceName,
		vrfName,
		peerIP,
		peerType,
		adminDown,
		deviceASN,
		peerAS,
		localAS,
		localAS_flags,
		routeMap_in,
		routeMap_out,

		// introduced by this script (from mergeInterfaceData map function)
		intf_name,
		intf_isShut,
		intf_ip,
		intf_ip_subnet,
		intf_desc,
		intf_ipType,
		intf_type,
		intf_vlan,
		intf_iplink,
		intf_iplink_vrf,
		intf_ip_acl_in,
		intf_ip_acl_out,
		intf_ip_mc_acl_out,
		intf_ip_mc_acl,
		intf_ip_pim_sparsemode,

		// more from bgp parsers
		has_sendCommunity,
		has_sendExtCommunity,
		has_sendLrgCommunity,
		is_ebgpMultihop,
		routerID,
		rd,
		desc,
		peerGroup,
		aggregateAddresses,
		redistributeConnected,
		redistributeStatic,
		deviceASN_asplain,
		peerAS_asplain,
		localAS_asplain,
		nextHopSelf,
		removePrivateAS,
		hasPassword,

		// droppped by this script
		bgpVrfProps,
		routeTargets_in,
		routeTargets_out,
		templateName,
		hasBFD,
		timers,
		maxRoutes__limit,
		maxRoutes__policy,
		_key_,
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		vrfName,
		peerIP,
		peerType,
		deviceASN,
		deviceASN_asplain,
		peerAS,
		peerAS_asplain,
		localAS,
		localAS_flags,
		localAS_asplain,
		presentedAS: localAS_asplain || deviceASN_asplain,
		routeMap_in,
		routeMap_out,
		desc: desc ? desc.replace(',', "") : '',
		is_ebgpMultihop,
		has_sendCommunity,
		intf_name,
		intf_isShut,
		intf_ip,
		intf_ip_subnet,
		intf_desc: intf_desc ? intf_desc.replace(',', "") : '',
		intf_ipType,
		intf_type,
		intf_vlan,
		intf_iplink,
		intf_iplink_vrf,
		intf_ip_acl_in,
		intf_ip_acl_out,
		intf_ip_mc_acl_out,
		intf_ip_mc_acl,
		intf_ip_pim_sparsemode,

		// other attributes...
		nextHopSelf,
		removePrivateAS,
		hasPassword,
		has_sendExtCommunity,
		has_sendLrgCommunity,
		routerID,
		peerGroup,
		aggregateAddresses,
		redistributeConnected,
		redistributeStatic,
		rd,
		adminDown,

		// By commenting out the below keys, they will be excluded from the results
		// bgpVrfProps,
		// routeTargets_in,
		// routeTargets_out,
		// templateName,
		// hasBFD,
		// timers,
		// maxRoutes__limit,
		// maxRoutes__policy,
		// _key_,
		// skippedCols,

		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})

	const bgpPeers = rawBgpPeers
		.map(mergeInterfaceData)
		.map(resolveLocalRouteMap)
		.map(formatColumns)

	if (bgpPeers.length == 0) {
		dataLog.push(`[${pmodule.name}]: No bgp peers were found on device. Verify the config has none, otherwise check the parser against the config.`)
		//throw new Error(`[${pmodule.name}]: No bgp peers were found on device. Verify the config has none, otherwise check the parser against the config.`)
	}
	
	// add error logs to the result
	yield Parser.of(null).insertLogs(dataLog)


	return bgpPeers

}).named(pmodule.name)


// comment out below for production
// get_bgpPeers('fake_device_name')

export {
	get_bgpPeers
}