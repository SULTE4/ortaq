List<int> buildingFloorPlan(Map<String, dynamic>? building) =>
    (building?['floor_plan'] as List? ?? []).cast<int>().toList();

Map<String, List<int>> buildingEntrancePlans(Map<String, dynamic>? building) =>
    {
      for (final entry in (building?['entrance_plans'] as Map? ?? {}).entries)
        entry.key as String: (entry.value as List).cast<int>().toList(),
    };

int buildingEntranceCount(Map<String, dynamic>? building) =>
    (building?['entrances'] as num?)?.toInt() ?? 0;

List<int> buildingPlanFor(Map<String, dynamic>? building, int entrance) =>
    buildingEntrancePlans(building)['$entrance'] ?? buildingFloorPlan(building);

String buildingPlanKey(
        Map<String, dynamic>? building, int entrance, int position) =>
    buildingEntrancePlans(building).containsKey('$entrance')
        ? '$entrance:$position'
        : '$position';

int buildingApartmentTotal(List<int> plan, Map<String, List<int>> entrancePlans,
    int entrances, int floors) {
  var total = 0;
  for (var e = 1; e <= entrances; e++) {
    total += (floors - 1) * (entrancePlans['$e'] ?? plan).length;
  }
  return total;
}

({int entrance, int floor, int position, int rooms, String key})?
    buildingApartmentLocation(Map<String, dynamic>? building, int apartment) {
  final floors = ((building?['floors'] as num?)?.toInt() ?? 0) - 1;
  if (apartment < 1 ||
      floors < 1 ||
      apartment > ((building?['apartments'] as num?)?.toInt() ?? 0))
    return null;
  var index = apartment - 1;
  for (var e = 1; e <= buildingEntranceCount(building); e++) {
    final plan = buildingPlanFor(building, e);
    final count = floors * plan.length;
    if (index < count) {
      final position = index % plan.length;
      return (
        entrance: e,
        floor: index ~/ plan.length + 2,
        position: position,
        rooms: plan[position],
        key: buildingPlanKey(building, e, position)
      );
    }
    index -= count;
  }
  return null;
}
