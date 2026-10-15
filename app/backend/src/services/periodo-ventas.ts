/** Fechas civiles del negocio; nunca dependen de la zona horaria del proceso. */
export function normalizarPeriodo(filtro: { fechaInicio?: string; fechaFin?: string }) {
  const zona = process.env.BUSINESS_TIME_ZONE || 'America/Mexico_City';
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const validarDia = (dia: string) => {
    const fecha = new Date(`${dia}T00:00:00.000Z`);
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== dia) {
      throw new RangeError('Fecha de calendario inválida.');
    }
    return fecha;
  };
  const medianoche = (dia: string) => {
    const civil = validarDia(dia).getTime();
    let instante = civil;
    for (let intento = 0; intento < 6; intento++) {
      const partes = Object.fromEntries(formato.formatToParts(instante).map(p => [p.type, p.value]));
      const local = Date.parse(`${partes['year']}-${partes['month']}-${partes['day']}T${partes['hour']}:${partes['minute']}:${partes['second']}Z`);
      const diferencia = civil - local;
      if (diferencia === 0) return new Date(instante).toISOString();
      instante += diferencia;
    }
    throw new RangeError('El límite del día no existe en la zona configurada.');
  };
  const convertir = (valor: string | undefined, fin: boolean): string | null => {
    if (valor === undefined || valor.trim() === '') return null;
    const texto = valor.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      const fecha = validarDia(texto);
      if (fin) fecha.setUTCDate(fecha.getUTCDate() + 1);
      return medianoche(fecha.toISOString().slice(0, 10));
    }
    // Los instantes completos deben incluir zona explícita; no aceptar normalización de días imposibles.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(texto)) {
      throw new RangeError('Use YYYY-MM-DD o un instante ISO con zona explícita.');
    }
    validarDia(texto.slice(0, 10));
    const instante = new Date(texto);
    if (!Number.isFinite(instante.getTime()) || Number(texto.slice(11, 13)) > 23) {
      throw new RangeError('Instante inválido.');
    }
    return instante.toISOString();
  };
  const fechaInicioISO = convertir(filtro.fechaInicio, false);
  const fechaFinISO = convertir(filtro.fechaFin, true);
  const fechaFinExclusiva = !!filtro.fechaFin && /^\d{4}-\d{2}-\d{2}$/.test(filtro.fechaFin.trim());
  if (fechaInicioISO && fechaFinISO && (fechaFinExclusiva ? fechaInicioISO >= fechaFinISO : fechaInicioISO > fechaFinISO)) {
    throw new RangeError('El inicio del periodo no puede ser posterior al fin.');
  }
  return { fechaInicioISO, fechaFinISO, fechaFinExclusiva };
}
