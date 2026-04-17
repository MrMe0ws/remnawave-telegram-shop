-- Тариф-наследник режима classic: пользователям с активной подпиской без current_tariff_id
-- проставляется ссылка на тариф со slug 'standard' (тот же, что создаётся из env при первом
-- открытии админки тарифов — см. tariff_admin.go). Тогда следующая покупка другого тарифа
-- обрабатывается как апгрейд/даунгрейд с пересчётом остатка (а не как «продление в лоб»).
--
-- Если «классика» у вас заведена под другим slug — выполните тот же UPDATE вручную,
-- заменив условие t.slug на нужное значение, или смените slug у строки tariff.

UPDATE customer AS c
SET current_tariff_id = t.id
FROM tariff AS t
WHERE t.slug = 'standard'
  AND c.current_tariff_id IS NULL
  AND c.expire_at IS NOT NULL
  AND c.expire_at > NOW();
