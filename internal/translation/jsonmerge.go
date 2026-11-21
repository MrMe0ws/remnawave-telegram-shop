package translation

import "encoding/json"

// DeepMergeJSON накладывает overlay на base: объекты сливаются по ключам
// рекурсивно, во всём остальном (скаляры, массивы) побеждает overlay, если
// ключ в нём есть. Массивы целиком заменяются намеренно: владелец, удаливший
// пункт из списка на диске, не должен получать его обратно из образа.
func DeepMergeJSON(base, overlay []byte) ([]byte, error) {
	var baseVal, overVal any
	if err := json.Unmarshal(base, &baseVal); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(overlay, &overVal); err != nil {
		return nil, err
	}
	return json.Marshal(mergeJSONValues(baseVal, overVal))
}

func mergeJSONValues(base, overlay any) any {
	baseMap, baseOK := base.(map[string]any)
	overMap, overOK := overlay.(map[string]any)
	if !baseOK || !overOK {
		return overlay
	}
	out := make(map[string]any, len(baseMap)+len(overMap))
	for k, v := range baseMap {
		out[k] = v
	}
	for k, v := range overMap {
		if existing, ok := out[k]; ok {
			out[k] = mergeJSONValues(existing, v)
		} else {
			out[k] = v
		}
	}
	return out
}
