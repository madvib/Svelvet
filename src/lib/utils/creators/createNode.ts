import { writable, derived } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type {
	Node,
	NodeConfig,
	Inputs,
	Properties,
	Parameter,
	InputKey,
	OutputKey,
	ParameterKey
} from '$lib/types';
import { get } from 'svelte/store';
import { NODE_BORDER_RADIUS, NODE_HEIGHT, NODE_WIDTH } from '$lib/constants';

export function createNode(userNode: NodeConfig): Node {
	const { id, config, width, height, dimensions, header, position } = userNode;
	const { bgColor, borderColor, borderRadius, textColor } = userNode;

	const newNode: Node = {
		id,
		position: {
			x: writable(position?.x || 0),
			y: writable(position?.y || 0)
		},
		dimensions: {
			width: writable(dimensions?.width || width || NODE_WIDTH),
			height: writable(dimensions?.height || height || NODE_HEIGHT)
		},
		group: writable(null),
		draggable: writable(true),
		selectable: writable(true),
		connectable: writable(true),
		deletable: writable(true),
		anchors: {},
		zIndex: writable(0),
		ariaLabel: `Node ${id}`,
		focusable: writable(true),
		resizable: writable(true),
		header: writable(userNode.header),
		collapsed: writable(false),
		visible: writable(true),
		collapsible: writable(true),
		inputs: writable({}),
		props: userNode.props || null,
		outputs: derived([], () => null),
		borderRadius: writable(borderRadius?.toString() || NODE_BORDER_RADIUS),
		properties: writable({}),
		bgColor: writable(bgColor || null),
		component: userNode.component || null,
		processor: (inputs, properties) => ({ ...inputs, ...properties }),
		componentRef: userNode.componentRef || 'default',
		label: writable(userNode?.data?.label || null)
	};

	if (borderColor) newNode.borderColor = borderColor;
	if (textColor) newNode.textColor = textColor;
	if (header) newNode.header = true;

	if (config) {
		const { properties, processor, inputs } = config;
		const inputsStore: Inputs = {};
		const propertiesStore: Properties = {};

		if (inputs) {
			for (const key in inputs) {
				//const inputKey: InputKey = `I-${key}/N-${id}`
				const input = inputs[key];
				inputsStore[key] = writable(input.initial);
			}
		}

		if (properties) {
			for (const key in properties) {
				//const propertyKey: ParameterKey = `P-${key}/N-${id}`
				const property = properties[key];
				propertiesStore[key] = writable(property.initial);
			}
		}

		newNode.config = config;
		newNode.properties = writable(propertiesStore);
		newNode.processor = processor;
		newNode.inputs = writable(inputsStore);
		newNode.outputs = createCustomDerivedStore(newNode.inputs, newNode.properties, processor);
	}

	return newNode;
}

function createCustomDerivedStore(
	inputs: Writable<Inputs>,
	properties: Writable<Properties>,
	processor: (inputs: any, properties: any) => any
) {
	const outputStore = writable({});

	const updateOutputStore = () => {
		const currentInputs: { [key: string]: Parameter } = {};
		const currentProperties: { [key: string]: Parameter } = {};

		for (const key in get(inputs)) {
			currentInputs[key] = get(get(inputs)[key]);
		}

		for (const key in get(properties)) {
			currentProperties[key] = get(get(properties)[key]);
		}
		console.log(currentInputs, currentProperties);
		outputStore.update(() => processor(currentInputs, currentProperties));
	};

	const unsubscribeFns: (() => void)[] = [];

	const subscribeToNestedStores = (store: Writable<any>) => {
		for (const key in get(store)) {
			get(store)[key].subscribe(() => {
				updateOutputStore();
			});
		}
	};

	// subscribeToNestedStores(inputs);
	// subscribeToNestedStores(properties);

	const unsubscribeInputs = inputs.subscribe(() => {
		unsubscribeFns.forEach((fn) => fn());
		unsubscribeFns.length = 0;
		subscribeToNestedStores(inputs);
	});

	const unsubscribeProperties = properties.subscribe(() => {
		unsubscribeFns.forEach((fn) => fn());
		unsubscribeFns.length = 0;
		subscribeToNestedStores(properties);
	});

	return {
		subscribe: outputStore.subscribe,
		unsubscribe: () => {
			unsubscribeInputs();
			unsubscribeProperties();
			unsubscribeFns.forEach((fn) => fn());
		}
	};
}

// type AutoUpdatingStore<T> = Writable<T> & {
// 	setNested: (key: string, newStore: Writable<any>) => void;
// 	triggerUpdate: () => void;
// };

// function createAutoUpdatingStore<T>(initialValue: T): AutoUpdatingStore<T> {
// 	const store = writable(initialValue);
// 	const unsubscribeFns: Map<string, () => void> = new Map();

// 	const customStore: AutoUpdatingStore<T> = {
// 		subscribe: store.subscribe,
// 		set: store.set,
// 		update: store.update,
// 		setNested: (key: string, newStore: Writable<any>) => {
// 			if (unsubscribeFns.has(key)) {
// 				unsubscribeFns.get(key)!();
// 			}

// 			const unsubscribe = newStore.subscribe((value: any) => {
// 				customStore.update(($store) => {
// 					($store as any)[key] = value;
// 					return $store;
// 				});
// 			});

// 			unsubscribeFns.set(key, unsubscribe);

// 			customStore.update(($store) => {
// 				($store as any)[key] = newStore;
// 				return $store;
// 			});
// 		},
// 		triggerUpdate: () => {
// 			store.update(($store) => {
// 				return { ...$store };
// 			});
// 		}
// 	};

// 	return customStore;
// }