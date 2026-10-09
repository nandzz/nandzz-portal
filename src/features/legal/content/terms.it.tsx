import { COMPANY as C, MIN_AGE, MIN_BUSINESS_AGE } from "../company";
import { A, B, Mail, P, Summary, Ul } from "../components/primitives";
import type { LegalDocument } from "../types";

export const termsIt: LegalDocument = {
  title: "Termini di Servizio",
  subtitle: "Il contratto tra te e Nandzz per l'uso di nandzz.com.",
  intro: (
    <Summary title="In breve">
      <Ul>
        <li>Nandzz è una piattaforma social che mette in contatto attività e clienti: una pagina personalizzata che riunisce prenotazioni, contenuti e link, per farti trovare e prenotare.</li>
        <li>I tuoi contenuti restano tuoi. Ci concedi solo i diritti necessari per far funzionare il servizio.</li>
        <li>I piani a pagamento si rinnovano automaticamente. Puoi disdirli in qualsiasi momento dalla dashboard e il piano resta attivo fino alla fine del periodo pagato.</li>
        <li>Se usi Nandzz per la tua attività, sei responsabile dei dati e delle prenotazioni dei tuoi clienti. Trattiamo quei dati per tuo conto secondo il nostro <A href="/dpa">DPA</A>.</li>
        <li>Se sei un consumatore, nulla in questi Termini riduce i diritti che la legge inderogabile ti riconosce.</li>
      </Ul>
      <P>Questa sintesi non fa parte dei Termini. Leggi il testo completo qui sotto.</P>
    </Summary>
  ),
  sections: [
    {
      id: "agreement",
      title: "Chi siamo e questo contratto",
      body: (
        <>
          <P>
            Nandzz (il &quot;<B>Servizio</B>&quot;) è gestito da <B>{C.legalName}</B>, con sede legale in{" "}
            {C.registeredOffice}, P.IVA {C.vatNumber} (&quot;<B>Nandzz</B>&quot;, &quot;<B>noi</B>&quot;). I
            dati societari completi sono nelle <A href="/legal">Note legali</A>.
          </P>
          <P>
            Questi Termini costituiscono un contratto vincolante tra te e Nandzz. Per usare il Servizio devi
            accettarli. Ne fanno parte anche:
          </P>
          <Ul>
            <li>la <A href="/acceptable-use">Policy di uso accettabile</A></li>
            <li>l&apos;<A href="/dpa">Accordo sul trattamento dei dati</A>, per gli account business</li>
            <li>le condizioni del piano mostrate all&apos;acquisto</li>
          </Ul>
          <P>
            L&apos;<A href="/privacy">Informativa privacy</A> e la <A href="/cookies">Cookie policy</A>{" "}
            spiegano come trattiamo i dati personali. Sono informative rivolte a te, non clausole contrattuali.
          </P>
          <P>
            &quot;<B>Consumatore</B>&quot; è la persona fisica che agisce per scopi estranei all&apos;attività
            imprenditoriale, commerciale, artigianale o professionale eventualmente svolta. &quot;
            <B>Professionista</B>&quot; è chi usa il Servizio per tali scopi. Alcune sezioni trattano questi due
            gruppi in modo diverso.
          </P>
        </>
      ),
    },
    {
      id: "service",
      title: "Il Servizio",
      body: (
        <>
          <P>Nandzz ti permette di:</P>
          <Ul>
            <li>creare una pagina pubblica con il tuo username</li>
            <li>pubblicarvi contenuti, come pagine web, file, elementi di galleria e link</li>
            <li>offrire funzioni, come la prenotazione online di appuntamenti</li>
            <li>interagire con altri utenti, ad esempio seguendo pagine, salvando contenuti in raccolte e prenotando appuntamenti</li>
          </Ul>
          <P>
            Alcune funzioni sono gratuite, altre richiedono un piano a pagamento o crediti. Cosa include ogni
            piano è indicato nella <A href="/pricing">pagina prezzi</A> e al checkout.
          </P>
          <P>
            Miglioriamo il Servizio di continuo e possiamo aggiungere, modificare o rimuovere funzioni. Se una
            modifica riduce in modo rilevante una funzione a pagamento che stai pagando, te lo comunicheremo in
            anticipo. Potrai allora recedere e ottenere il rimborso pro rata del periodo prepagato non goduto.
          </P>
        </>
      ),
    },
    {
      id: "eligibility",
      title: "Requisiti e account",
      body: (
        <>
          <P>
            Per creare un account devi avere almeno <B>{MIN_AGE} anni</B>. Se sei minorenne secondo la legge del
            tuo paese, confermi che un genitore o tutore ha accettato questi Termini per te.
          </P>
          <P>
            Devi essere maggiorenne (<B>{MIN_BUSINESS_AGE} anni</B>) e avere il potere di vincolare
            l&apos;attività per:
          </P>
          <Ul>
            <li>usare il Servizio per un&apos;attività</li>
            <li>ricevere prenotazioni o pagamenti tramite il Servizio</li>
            <li>acquistare un piano a pagamento</li>
          </Ul>
          <P>
            Mantieni i dati dell&apos;account corretti e la password riservata. Sei responsabile delle attività
            svolte con il tuo account, salvo che siano dovute a una nostra mancanza. Se sospetti accessi non
            autorizzati, scrivici subito a <Mail to={C.emails.support} />.
          </P>
          <P>
            Gli username sono assegnati in ordine di richiesta. Possiamo riassegnare uno username che:
          </P>
          <Ul>
            <li>impersona altri</li>
            <li>viola un marchio</li>
            <li>è inattivo ed è richiesto dal titolare di un diritto</li>
          </Ul>
        </>
      ),
    },
    {
      id: "business-users",
      title: "Uso di Nandzz per la tua attività",
      body: (
        <>
          <P>Se usi il Servizio per un&apos;attività, comprese le prenotazioni:</P>
          <Ul>
            <li>
              Sei <B>titolare del trattamento</B> dei dati personali dei tuoi clienti, come nomi, telefoni,
              email, note e messaggi in chat. Noi agiamo come <B>responsabile del trattamento</B> secondo
              l&apos;<A href="/dpa">Accordo sul trattamento dei dati</A>, che accetti accettando questi Termini.
            </li>
            <li>
              Devi fornire ai tuoi clienti le informazioni richieste dalla normativa privacy. Le nostre pagine di
              prenotazione rimandano alla nostra Informativa, che spiega il nostro ruolo. Resti responsabile della
              tua informativa e di avere una base giuridica per i messaggi che invii.
            </li>
            <li>
              Il contratto per i servizi che offri tramite una prenotazione è tra te e il tuo cliente. Nandzz
              non ne è parte. Sei l&apos;unico responsabile di:
              <Ul>
                <li>servizi, prezzi, regole di cancellazione, orari e personale</li>
                <li>la correttezza di ciò che pubblichi</li>
                <li>il rispetto delle norme sui consumatori, fiscali e di settore che ti si applicano</li>
              </Ul>
            </li>
            <li>
              Non userai il Servizio per inviare ai clienti messaggi promozionali o di altro tipo senza il loro
              consenso preventivo, ove la legge lo richieda.
            </li>
          </Ul>
          <P>
            I professionisti riconoscono che le tutele per i consumatori previste in questi Termini non si
            applicano a loro, salvo norme inderogabili.
          </P>
        </>
      ),
    },
    {
      id: "payments",
      title: "Piani, prove gratuite, crediti e pagamenti",
      body: (
        <>
          <P>
            <B>Prezzi.</B> I prezzi sono mostrati prima del pagamento. Per i consumatori sono IVA inclusa. Per i
            professionisti possiamo aggiungere IVA o altre imposte, ove applicabili. I pagamenti sono gestiti da
            Stripe. Non vediamo né conserviamo i dati completi della tua carta.
          </P>
          <P>
            <B>Rinnovo automatico.</B> Un piano a pagamento si rinnova alla fine di ogni periodo (mensile o
            annuale) al prezzo allora in vigore, finché non lo disdici. Puoi disdire in qualsiasi momento dalla
            dashboard, in Fatturazione / Gestisci abbonamento. La disdetta ha effetto alla fine del periodo in
            corso, e fino ad allora mantieni l&apos;accesso. Ti avviseremo di ogni aumento di prezzo almeno 30
            giorni prima che si applichi a te. Puoi disdire prima di allora.
          </P>
          <P>
            <B>Prove gratuite.</B> Se un piano prevede una prova gratuita, la durata e il prezzo successivo sono
            indicati al checkout. Il primo addebito avviene alla fine della prova, salvo disdetta prima. Ogni
            account può usare una sola prova.
          </P>
          <P>
            <B>Crediti.</B> Alcune funzioni, come l&apos;uso dell&apos;IA, consumano crediti.
          </P>
          <Ul>
            <li>
              I <B>crediti del piano</B> sono inclusi in un piano. Si azzerano a ogni periodo e non si
              accumulano.
            </li>
            <li>
              I <B>crediti acquistati</B> non scadono finché l&apos;account esiste.
            </li>
            <li>
              I crediti non hanno valore monetario. Non sono cedibili e si usano solo su Nandzz.
            </li>
            <li>
              I crediti non usati si perdono con la cancellazione dell&apos;account, salvo i rimborsi dovuti
              secondo la sezione 6 o la legge inderogabile.
            </li>
          </Ul>
          <P>
            <B>Pagamenti non riusciti.</B> Se un rinnovo non va a buon fine, possiamo ritentare l&apos;addebito
            e, dopo un ragionevole periodo di tolleranza, passare l&apos;account al piano gratuito. I tuoi
            contenuti restano disponibili entro i limiti del piano gratuito.
          </P>
          <P>
            <B>Rimborsi.</B> Salvo la sezione 6 e i tuoi diritti di legge, i pagamenti non sono rimborsabili. I
            periodi parziali non sono rimborsati dopo la disdetta. Rimborsiamo sempre gli importi addebitati per
            errore.
          </P>
        </>
      ),
    },
    {
      id: "withdrawal",
      title: "Diritto di recesso (consumatori UE/UK)",
      body: (
        <>
          <P>
            Se sei un consumatore nell&apos;UE, nel SEE o nel Regno Unito, hai il <B>diritto di recedere entro
            14 giorni</B> da un contratto a distanza senza indicarne il motivo (artt. 52 ss. Codice del Consumo,
            D.Lgs. 206/2005).
          </P>
          <Ul>
            <li>
              <B>Abbonamenti (servizio digitale).</B> Puoi recedere entro 14 giorni dalla sottoscrizione.
              <Ul>
                <li>
                  Se hai chiesto che il servizio inizi durante quel periodo, cosa che avviene quando ti abboni e
                  inizi a usare le funzioni a pagamento, rimborsiamo il pagamento meno un importo proporzionale al
                  servizio fornito fino al recesso.
                </li>
                <li>
                  I giorni di prova gratuita non sono addebitati.
                </li>
              </Ul>
            </li>
            <li>
              <B>Pacchetti di crediti (contenuto digitale).</B> I crediti vengono accreditati subito.
              <Ul>
                <li>
                  Al checkout chiedi espressamente la fornitura immediata e riconosci di <B>perdere il diritto di
                  recesso</B> una volta accreditati i crediti (art. 59, c. 1, lett. o) Codice del Consumo).
                </li>
                <li>
                  Se non hai usato alcun credito del pacchetto, scrivici entro 14 giorni e ti rimborseremo
                  comunque, per cortesia commerciale.
                </li>
              </Ul>
            </li>
          </Ul>
          <P>
            Per recedere, invia una dichiarazione esplicita a <Mail to={C.emails.support} /> dall&apos;email del
            tuo account. Puoi usare questo modello:
          </P>
          <P>
            &quot;Con la presente comunico il recesso dal contratto relativo a [piano/pacchetto crediti],
            ordinato il [data]. Nome, email dell&apos;account, data.&quot;
          </P>
          <P>
            Rimborsiamo entro 14 giorni con lo stesso mezzo di pagamento.
          </P>
        </>
      ),
    },
    {
      id: "content",
      title: "I tuoi contenuti",
      body: (
        <>
          <P>
            Mantieni tutti i diritti su ciò che carichi o pubblichi (&quot;<B>Tuoi Contenuti</B>&quot;). Questo
            comprende testi, immagini, file, pagine HTML, link, documenti forniti al tuo agente IA e il tuo
            branding.
          </P>
          <P>
            Concedi a Nandzz una licenza mondiale, non esclusiva e gratuita per ospitare, conservare, riprodurre,
            adattare e mostrare i Tuoi Contenuti. La licenza copre:
          </P>
          <Ul>
            <li>l&apos;adattamento tecnico, come ridimensionamento, anteprime e indicizzazione</li>
            <li>la visualizzazione dei Tuoi Contenuti nella tua pagina e in altre parti del Servizio</li>
          </Ul>
          <P>
            Usiamo questa licenza solo per fornire, proteggere e migliorare il Servizio, e per mostrare i Tuoi
            Contenuti secondo le tue impostazioni (pubblico o privato). Possiamo sublicenziarla solo ai nostri
            sub-responsabili e per gli stessi scopi. La licenza termina quando elimini i contenuti o
            l&apos;account, salvo:
          </P>
          <Ul>
            <li>le copie nei backup, per un periodo limitato</li>
            <li>le copie che dobbiamo conservare per legge</li>
          </Ul>
          <P>
            Non usiamo i Tuoi Contenuti né i dati dei tuoi clienti per addestrare modelli di IA, e non lo
            consentiamo ai nostri fornitori di IA.
          </P>
          <P>
            Dichiari di avere tutti i diritti necessari per pubblicare i Tuoi Contenuti. Dichiari anche che sono
            conformi alla legge e alla <A href="/acceptable-use">Policy di uso accettabile</A>.
          </P>
          <P>
            I contenuti pubblici possono essere visti, collegati e condivisi da chiunque. Assicurati che ti vada
            bene prima di pubblicarli.
          </P>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Uso accettabile",
      body: (
        <P>
          Devi rispettare la <A href="/acceptable-use">Policy di uso accettabile</A>. In sintesi: niente
          contenuti o comportamenti illeciti, dannosi, ingannevoli o in violazione di diritti altrui, e nessun
          tentativo di violare, sovraccaricare o abusare del Servizio, degli altri utenti o dei tuoi clienti.
        </P>
      ),
    },
    {
      id: "moderation",
      title: "Segnalazioni, moderazione e reclami",
      body: (
        <>
          <P>
            Agiamo come servizio di hosting ai sensi del Digital Services Act (Regolamento (UE) 2022/2065,
            &quot;DSA&quot;). Non controlliamo i contenuti prima della pubblicazione. Interveniamo sulle
            segnalazioni e possiamo verificare di nostra iniziativa contenuti che potrebbero violare la legge o
            le nostre policy.
          </P>
          <Ul>
            <li>
              <B>Segnala un contenuto</B> tramite il <A href="/report">modulo di segnalazione</A> o il link
              &quot;Segnala&quot; nelle pagine pubbliche. Trattiamo le segnalazioni con diligenza e senza
              ritardi ingiustificati, e comunichiamo la decisione a chi ha segnalato.
            </li>
            <li>
              <B>Possibili provvedimenti</B>:
              <Ul>
                <li>rimozione o disabilitazione del contenuto</li>
                <li>limitazione della visibilità o delle funzioni</li>
                <li>sospensione o chiusura dell&apos;account</li>
              </Ul>
              Agiamo in modo proporzionato, tenendo conto della gravità, della frequenza e
              dell&apos;intenzionalità della violazione.
            </li>
            <li>
              <B>Motivazione.</B> Quando limitiamo un tuo contenuto o account, ti comunichiamo cosa abbiamo
              fatto, perché e come contestarlo. Fanno eccezione i casi in cui la legge lo vieta, o in cui si
              tratta di contenuti commerciali ingannevoli ad alto volume.
            </li>
            <li>
              <B>Reclami.</B> Puoi contestare ogni decisione entro 6 mesi, rispondendo alla nostra comunicazione o
              scrivendo a <Mail to={C.emails.dsa} />. I reclami sono esaminati da una persona, non solo da un
              sistema automatico. Puoi anche rivolgerti a un organismo certificato di risoluzione extragiudiziale
              (art. 21 DSA) o al giudice.
            </li>
            <li>
              <B>Abusi.</B> Possiamo sospendere, per un periodo ragionevole e previo avviso, chi:
              <Ul>
                <li>pubblica frequentemente contenuti manifestamente illegali</li>
                <li>invia frequentemente segnalazioni manifestamente infondate</li>
              </Ul>
            </li>
            <li>
              <B>Reati.</B> Comunichiamo alle autorità le informazioni che fanno sospettare reati che minacciano
              la vita o la sicurezza delle persone. Segnaliamo anche il materiale pedopornografico.
            </li>
          </Ul>
          <P>
            Il nostro punto di contatto unico per autorità e utenti ai sensi del DSA è{" "}
            <Mail to={C.emails.dsa} />. Comunichiamo in italiano e in inglese.
          </P>
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "Proprietà intellettuale",
      body: (
        <>
          <P>
            Il Servizio, il software, il design, il nome e il logo Nandzz appartengono a noi o ai nostri
            licenzianti. Non puoi usarli senza nostro consenso scritto, salvo per riferirti correttamente al
            Servizio.
          </P>
          <P>
            Se ritieni che un contenuto su Nandzz violi il tuo diritto d&apos;autore o un altro diritto, usa il{" "}
            <A href="/report">modulo di segnalazione</A>. Scegli &quot;Proprietà intellettuale&quot; e indica
            l&apos;opera e l&apos;URL del contenuto in violazione.
          </P>
          <P>
            <B>Notifiche DMCA (USA).</B> I titolari di diritti negli Stati Uniti possono anche inviare una
            notifica ai sensi del 17 U.S.C. § 512 a <Mail to={C.emails.legal} />. La notifica deve indicare:
          </P>
          <Ul>
            <li>l&apos;opera violata</li>
            <li>l&apos;URL del contenuto in violazione</li>
            <li>i tuoi recapiti</li>
            <li>una dichiarazione di buona fede</li>
            <li>una dichiarazione di essere autorizzato ad agire, resa sotto pena di falsa testimonianza</li>
            <li>la tua firma</li>
          </Ul>
          <P>
            Chi ha caricato il contenuto può inviare una contro-notifica. Disattiviamo gli account dei
            trasgressori recidivi.
          </P>
        </>
      ),
    },
    {
      id: "ai",
      title: "Funzioni di intelligenza artificiale",
      body: (
        <>
          <P>
            Alcune funzioni possono usare l&apos;intelligenza artificiale, come la modifica assistita. Quando un
            sistema di IA interagisce con i visitatori, li informa che stanno interagendo con un sistema di IA, come
            richiesto dall&apos;AI Act europeo. I professionisti non devono nascondere né rimuovere tale avviso.
          </P>
          <P>
            I risultati dell&apos;IA sono generati automaticamente e possono essere inesatti, incompleti o
            inappropriati. Verifica le informazioni importanti prima di farvi affidamento.
          </P>
          <P>
            I professionisti sono responsabili:
          </P>
          <Ul>
            <li>dei documenti e delle istruzioni che forniscono al loro agente</li>
            <li>delle risposte che gli permettono di dare per loro conto</li>
          </Ul>
          <P>
            Non usare le funzioni di IA per prendere decisioni che producono effetti giuridici o
            altrettanto significativi sulle persone.
          </P>
        </>
      ),
    },
    {
      id: "third-parties",
      title: "Servizi e link di terzi",
      body: (
        <P>
          Il Servizio può contenere link o integrazioni con servizi che non controlliamo. Ne sono esempi
          l&apos;accesso con Google, Stripe, WhatsApp, e i link o le pagine incorporate pubblicati dagli utenti.
          Si applicano i loro termini e le loro informative privacy. Non siamo responsabili dei loro contenuti né
          delle loro pratiche.
        </P>
      ),
    },
    {
      id: "availability",
      title: "Disponibilità e sicurezza",
      body: (
        <P>
          Ci impegniamo a mantenere il Servizio disponibile e sicuro, ma non garantiamo un funzionamento
          ininterrotto o privo di errori. Manutenzione, incidenti o eventi fuori dal nostro ragionevole controllo
          possono causare interruzioni. I contenuti web caricati dagli utenti girano in frame isolati
          (sandbox), ma apri comunque solo contenuti di cui ti fidi. Conserva copie dei contenuti importanti.
          Puoi esportare i tuoi dati in qualsiasi momento dalle Impostazioni.
        </P>
      ),
    },
    {
      id: "termination",
      title: "Sospensione, cessazione e cancellazione",
      body: (
        <>
          <P>
            Puoi smettere di usare il Servizio e cancellare l&apos;account in qualsiasi momento dalle
            Impostazioni. La cancellazione:
          </P>
          <Ul>
            <li>annulla subito eventuali abbonamenti attivi</li>
            <li>rimuove la tua pagina e i tuoi contenuti</li>
            <li>rimuove i tuoi dati personali come descritto nell&apos;<A href="/privacy">Informativa privacy</A></li>
          </Ul>
          <P>
            Prima di cancellare puoi scaricare una copia dei tuoi dati dalle Impostazioni.
          </P>
          <P>
            Possiamo sospendere o chiudere l&apos;account se:
          </P>
          <Ul>
            <li>violi questi Termini in modo grave o ripetuto</li>
            <li>la legge ce lo impone</li>
            <li>proseguire esporrebbe noi o altri a un danno grave</li>
          </Ul>
          <P>
            Salvo violazioni gravi o divieti di legge, ti avviseremo prima e ti daremo un tempo ragionevole per
            rimediare. Se chiudiamo un piano a pagamento senza giusta causa, o per motivi non imputabili a te,
            rimborsiamo il periodo prepagato non goduto.
          </P>
          <P>
            Possiamo anche interrompere il piano gratuito, o il Servizio nel suo complesso, con almeno 60 giorni
            di preavviso. Ti lasceremo il tempo di esportare i tuoi dati.
          </P>
        </>
      ),
    },
    {
      id: "warranties",
      title: "Garanzie di legge",
      body: (
        <>
          <P>
            I <B>consumatori</B> beneficiano della garanzia legale di conformità per contenuti e servizi
            digitali (artt. 135-octies ss. Codice del Consumo). Nulla in questi Termini la limita.
          </P>
          <P>
            <B>Professionisti.</B> Nei limiti di legge, il Servizio è fornito &quot;così com&apos;è&quot; e
            &quot;come disponibile&quot;. Non diamo garanzie implicite di commerciabilità, idoneità a uno scopo
            particolare o non violazione.
          </P>
        </>
      ),
    },
    {
      id: "liability",
      title: "Responsabilità",
      body: (
        <>
          <P>
            Nulla in questi Termini esclude o limita la responsabilità che non può essere limitata per legge.
            Ciò comprende la responsabilità per:
          </P>
          <Ul>
            <li>morte o lesioni personali causate da negligenza</li>
            <li>frode</li>
            <li>dolo o colpa grave (art. 1229 c.c.)</li>
            <li>i diritti di legge del consumatore</li>
          </Ul>
          <P>
            <B>Consumatori.</B> Rispondiamo dei danni prevedibili causati da un nostro inadempimento. Non
            rispondiamo dei danni:
          </P>
          <Ul>
            <li>non prevedibili</li>
            <li>causati da un tuo inadempimento</li>
            <li>dovuti a eventi fuori dal nostro ragionevole controllo</li>
          </Ul>
          <P>
            <B>Professionisti.</B> Fermo il primo paragrafo, non rispondiamo di:
          </P>
          <Ul>
            <li>danni indiretti o consequenziali</li>
            <li>mancati profitti, ricavi o prenotazioni, perdita di avviamento o di dati</li>
          </Ul>
          <P>
            La nostra responsabilità complessiva verso un professionista in un periodo di 12 mesi è limitata
            all&apos;importo maggiore tra:
          </P>
          <Ul>
            <li>quanto ci hai pagato in quel periodo</li>
            <li>100 EUR</li>
          </Ul>
          <P>
            Non siamo responsabili dei contenuti pubblicati dagli utenti, né dei servizi che le attività
            forniscono ai loro clienti. Il nostro ruolo di hosting ai sensi del DSA è descritto nella sezione 9.
          </P>
        </>
      ),
    },
    {
      id: "indemnity",
      title: "Manleva (professionisti)",
      body: (
        <>
          <P>
            Se sei un professionista, ci terrai indenni da pretese di terzi, sanzioni e costi ragionevoli
            derivanti da:
          </P>
          <Ul>
            <li>i Tuoi Contenuti</li>
            <li>i tuoi rapporti con i tuoi clienti</li>
            <li>la tua violazione di questi Termini, del DPA o della legge</li>
          </Ul>
          <P>
            Ti informeremo tempestivamente di qualsiasi pretesa di questo tipo e ti consentiremo di partecipare
            alla sua gestione.
          </P>
        </>
      ),
    },
    {
      id: "changes",
      title: "Modifiche ai Termini",
      body: (
        <>
          <P>Possiamo aggiornare questi Termini per uno di questi motivi:</P>
          <Ul>
            <li>per riflettere modifiche al Servizio</li>
            <li>per riflettere modifiche di legge</li>
            <li>per motivi di sicurezza</li>
            <li>per maggiore chiarezza</li>
          </Ul>
          <P>
            Per le <B>modifiche sostanziali</B> ti avvisiamo via email e nell&apos;app almeno <B>30 giorni</B>{" "}
            prima che entrino in vigore. Puoi allora:
          </P>
          <Ul>
            <li>accettarle, cliccando &quot;Accetta&quot; o continuando a usare il Servizio dopo la data di efficacia</li>
            <li>chiudere l&apos;account prima di quella data, con rimborso pro rata del periodo prepagato non goduto</li>
          </Ul>
          <P>
            Le modifiche imposte dalla legge, o solo a tuo favore, possono applicarsi prima. Le versioni
            precedenti sono disponibili su richiesta.
          </P>
        </>
      ),
    },
    {
      id: "law",
      title: "Legge applicabile e controversie",
      body: (
        <>
          <P>Questi Termini sono regolati dalla legge italiana.</P>
          <P>
            I <B>consumatori</B> mantengono la tutela delle norme inderogabili del paese in cui vivono e possono
            agire davanti ai giudici del proprio paese. Se vivi in Italia, è competente in via inderogabile il
            giudice del luogo di tua residenza o domicilio (art. 66-bis Codice del Consumo).
          </P>
          <P>
            <B>Professionisti.</B> È competente in via esclusiva il foro della nostra sede legale.
          </P>
          <P>
            Ti invitiamo a contattarci prima a <Mail to={C.emails.support} />: la maggior parte dei problemi si
            risolve rapidamente così. I consumatori possono anche rivolgersi a un organismo di risoluzione
            alternativa delle controversie (ADR). Ti diremo se accettiamo di partecipare a una specifica
            procedura. Resta salvo il diritto di rivolgersi al giudice.
          </P>
        </>
      ),
    },
    {
      id: "general",
      title: "Disposizioni generali",
      body: (
        <Ul>
          <li>
            Se una clausola risulta invalida, il resto dei Termini resta in vigore. La clausola invalida è
            sostituita dalla clausola valida più vicina al suo scopo.
          </li>
          <li>
            Non puoi cedere i tuoi diritti senza il nostro consenso. Possiamo cedere i nostri a una società che
            subentri nel Servizio. In tal caso ti avviseremo e potrai chiudere l&apos;account.
          </li>
          <li>
            Il mancato esercizio immediato di un diritto non costituisce rinuncia.
          </li>
          <li>
            I Termini sono disponibili in italiano e in inglese. Per i consumatori residenti in Italia prevale la
            versione italiana.
          </li>
        </Ul>
      ),
    },
    {
      id: "contact",
      title: "Contatti",
      body: (
        <P>
          {C.legalName}, {C.registeredOffice}.
          <br />
          Assistenza: <Mail to={C.emails.support} /> · Legale: <Mail to={C.emails.legal} /> · PEC: {C.pec}
        </P>
      ),
    },
  ],
};
