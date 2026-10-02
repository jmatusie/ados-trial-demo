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
  Parser,

} from '../parser_modules.mjs'



import { get_eoscfg_interfaces } from '../eos-cfg/get_eoscfg_interfaces.mjs'
import { get_nxcfg_interfaces } from '../nxos-cfg/get_nxcfg_interfaces.mjs'


/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_ipInterfaces',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}


const get_ipInterfaces = (deviceName, deviceOS) => coroutine(function* () {
	const dataLog = []

	const rawInterfaces = 
		(deviceOS == 'EOS') ? 	yield possibly(lookAhead(get_eoscfg_interfaces(deviceName))).map(nullToArray)
		: (deviceOS == 'NX-OS') ? yield possibly(lookAhead(get_nxcfg_interfaces(deviceName))).map(nullToArray)
		: null

	if (rawInterfaces == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}

	const addSubnetColumn = ({ interfaceName, ip_addr, ip_masklen, ...rest }) => ({
		interfaceName,
		ip_addr,
		ip_masklen,
		ip_subnet: IPv4.of(`${ip_addr}/${ip_masklen}`)?.getNetwork()?.toString() ?? console.warn(`${deviceName}: [formatColumns]: invalid_ip_address on interface ${interfaceName}`, ip_addr) ?? `INVALID_ip_addr`,
		...rest
	})

	const addVlanTag = ({ interfaceName, dot1q, type, ...rest }) => ({
		interfaceName,
		dot1q,
		type,
		vlan_tag: (dot1q) || ((type == 'svi') ? interfaceName.match(/vl[an]*(?<vlan>\d+)/i)?.groups['vlan'] : '0'),
		...rest
	})



	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering, & re-order the rest
	const formatColumns = ({
		// common & important configs
		deviceName,
		interfaceName,
		ip_addr,
		ip_masklen,
		ip_subnet,								// added by 'addSubnetColumn'
		vrf = 'default',					// standardized name for global routing table
		vlan_tag,
		type,											// added by function 'classifyInteraceType'
		admin_down,
		ip_type,
		port_mode,

		desc,
		ip_unnumbered,
		dot1q,
		ip_acl_in,
		ip_acl_out,

		// L2 common & important configs:
		explicit_switchport,
		explicit_no_switchport,
		is_switchport,
		l2_mode,
		l2_access_vlan,
		l2_native_vlan,
		l2_allowed_vlan,

		// MCAST / PIM / IGMP
		ip_mc_acl,
		ip_mc_acl_out,
		ip_pim_sparsemode,
		ip_pim_dr_priority,
		ip_pim_neighbor_filter,
		ip_pim_border,
		ip_pim_bsr_border,
		igmp_version,

		// Flag only (for further config fetching)
		hascfg_igmp_static,
		hascfg_igmp_host_proxy,
		hascfg_nat,
		hascfg_dhcp_client,
		hascfg_dhcp_server,
		hascfg_dhcp_proxy,
		hascfg_evpn,
		hascfg_vxlan,
		hascfg_te,
		hascfg_tunnel,
		hascfg_ospf,
		hascfg_mpls,
		hascfg_sr,
		hascfg_isis,

		// FHRP items:
		varp_ip,
		vrrp_id,
		vrrp_ip,
		vrrp_priority,
		vrrp_desc,
		vrrp_UNK,

		// spanning-tree:
		stp_portfast,
		stp_bpdufilter,
		stp_bpduguard,
		channel_group,

		// ptp
		ptp_enabled,
		ptp_role,
		ptp_sync_interval,
		ptp_delay_req_interval,
		ptp_delay_mech,
		ptp_vlan,
		ptp_UNK,
		

		// lldp
		lldp_disabled,
		lldp_no_tx,
		lldp_no_rx,
		lldp_UNK,

		// miscellaneous items
		hascfg_flowcontrol,
		speed,
		bfd_cfg,
		no_autostate,
		load_interval,
		mtu,
		has_svc_policy_cfg,

		l2_access,
		
		stp_bpduflter,
		bfdCfg,
		queueMonitor,
		trunk_group,
		l2_trunk_UNK,
		l2_access_UNK,
		is_shutdown,

		// believed to be EOS only
		has_shaping_cfg,
		vlan_id,
		queue_monitor,
		mlag_id,
		UNK_eosos_cfg_interface,

		// believed to be NX-OS only
		ip_pim_jppolicy,
		hsrp_preempt,
		hsrp_ip,
		hsrp_id,
		hsrp_priority,
		UNK_nxos_cfg_interface,

		_key_: _fkey_interfaces_,  // NOTE: the _key_ from the parsers output will be a foreign key form an ipInterfaces point of view - see _key_ below for more context
		skippedCols,
		...skipped
	}) => ({
		deviceName,
		deviceOS,
		interfaceName,
		ip_addr,
		ip_masklen,
		ip_subnet,								// added by 'addSubnetColumn'
		vrf,
		vlan_tag,
		type,											// added by function 'classifyInteraceType'
		admin_down,
		ip_type,
		port_mode,
		mtu,
		desc,
		ip_unnumbered,
		dot1q,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		igmp_version,
		
		// Flag only (for further config fetching)
		hascfg_igmp_static,
		hascfg_igmp_host_proxy,
		hascfg_nat,
		hascfg_dhcp_client,
		hascfg_dhcp_server,
		hascfg_dhcp_proxy,
		hascfg_evpn,
		hascfg_vxlan,
		hascfg_te,
		hascfg_tunnel,
		hascfg_ospf,
		hascfg_mpls,
		hascfg_sr,
		hascfg_isis,

		// FHRP items:
		varp_ip,
		vrrp_id,
		vrrp_ip,
		vrrp_priority,
		vrrp_desc,
		vrrp_UNK,

		// misc
		speed,

		_fkey_interfaces_,   // <-- foreign key from interfaces, which uses deviceName & interface name
		_key_: `${deviceName}:${vrf}:${ipAddress}`, // <-- this module introduces a key for interfaces with a unique IP address
		iplink: `${vlan_tag}:${ip_subnet}`, // <-- key to identify a unique link ID.  In theory, should match only one other device - the BGP peer
		iplink_vrf: `${vrf}:${vlan_tag}:${ip_subnet}`, // <-- key to identify a unique link ID with matching VRF.  In theory, should match only one other device - the BGP peer if the VRFs are the same
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')} ${skippedCols}`
	})


	// ip interfaces here are defined as any having an IP address (i.e. non-empty ipType)

	const ipInterfaces = rawInterfaces
		.filter((intf) => intf.ip_type !== '')
		.map(addSubnetColumn)
		.map(addVlanTag)
		.map(formatColumns)

	if (ipInterfaces.length == 0) {
		throw new Error(`[${pmodule.name}]: No ip-enabled interfaces were found on device. Verify the config has none, otherwise check the parser against the config.`)
	}

	// add error logs to the result
	yield Parser.of(null).insertLogs(dataLog)

	return ipInterfaces

}).named(pmodule.name)



// comment out for production
// get_ipInterfaces('fake_device_name')


export {
	get_ipInterfaces,
}