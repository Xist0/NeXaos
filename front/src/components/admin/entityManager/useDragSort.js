import { useCallback, useMemo, useState } from "react";

const useDragSort = ({ endpoint, items, put, fetchItems, logger }) => {
  const isReorderable = endpoint === "/hero-slides" || endpoint === "/works";

  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [savingSortOrder, setSavingSortOrder] = useState(false);

  const orderedItems = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    if (!isReorderable) return arr;

    arr.sort((a, b) => {
      const ao = Number(a?.sort_order);
      const bo = Number(b?.sort_order);
      const aHas = Number.isFinite(ao);
      const bHas = Number.isFinite(bo);
      if (aHas && bHas) return ao - bo;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });

    return arr;
  }, [isReorderable, items]);

  const persistSortOrder = useCallback(
    async (nextOrdered) => {
      if (!isReorderable) return;
      if (!Array.isArray(nextOrdered) || nextOrdered.length === 0) return;

      setSavingSortOrder(true);
      try {
        const updates = [];
        for (let i = 0; i < nextOrdered.length; i++) {
          const it = nextOrdered[i];
          const desired = i + 1;
          if (!it?.id) continue;
          if (Number(it.sort_order) === desired) continue;
          updates.push({ id: it.id, sort_order: desired });
        }

        await Promise.all(updates.map((u) => put(`${endpoint}/${u.id}`, { sort_order: u.sort_order })));
        await fetchItems();
      } catch (error) {
        logger.error("Не удалось сохранить порядок", error);
        await fetchItems();
      } finally {
        setSavingSortOrder(false);
      }
    },
    [endpoint, fetchItems, isReorderable, logger, put]
  );

  const getRowProps = useCallback(
    (item) => {
      if (!isReorderable) return {};
      if (!item?.id) return {};

      return {
        draggable: Boolean(item?.id) && !savingSortOrder,
        onDragStart: (e) => {
          if (!item?.id) return;
          setDraggingId(item.id);
          setDragOverId(item.id);
          try {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(item.id));
          } catch {
            // ignore
          }
        },
        onDragOver: (e) => {
          if (!draggingId || !item?.id) return;
          e.preventDefault();
          setDragOverId(item.id);
        },
        onDrop: async (e) => {
          if (!draggingId || !item?.id) return;
          e.preventDefault();

          const list = orderedItems;
          const fromIndex = list.findIndex((x) => String(x?.id) === String(draggingId));
          const toIndex = list.findIndex((x) => String(x?.id) === String(item.id));
          if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
            setDraggingId(null);
            setDragOverId(null);
            return;
          }

          const next = [...list];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);

          setDraggingId(null);
          setDragOverId(null);
          await persistSortOrder(next);
        },
        onDragEnd: () => {
          setDraggingId(null);
          setDragOverId(null);
        },
      };
    },
    [draggingId, isReorderable, orderedItems, persistSortOrder, savingSortOrder]
  );

  return {
    isReorderable,
    orderedItems,
    savingSortOrder,
    draggingId,
    dragOverId,
    getRowProps,
  };
};

export default useDragSort;
