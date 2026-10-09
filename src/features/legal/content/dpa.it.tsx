import { COMPANY as C } from "../company";
import { A, B, H3, Mail, P, Ul } from "../components/primitives";
import { SubprocessorTable } from "../components/SubprocessorTable";
import type { LegalDocument } from "../types";

export const dpaIt: LegalDocument = {
  title: "Accordo sul trattamento dei dati (DPA)",
  subtitle:
    "Condizioni ex art. 28 GDPR per le attività che usano Nandzz per trattare i dati dei propri clienti. Fa parte dei Termini di Servizio. Non serve firmarlo.",
  sections: [
    {
      id: "parties",
      title: "Parti e ambito",
      body: (
        <>
          <P>
            Il presente accordo (&quot;<B>DPA</B>&quot;) è concluso tra:
          </P>
          <Ul>
            <li>
              il titolare dell&apos;account business (&quot;<B>Titolare</B>&quot;, &quot;<B>tu</B>&quot;)
            </li>
            <li>
              {C.legalName} (&quot;<B>Responsabile</B>&quot;, &quot;<B>Nandzz</B>&quot;)
            </li>
          </Ul>
          <P>
            Si applica ogni volta che Nandzz, nel fornire il Servizio, tratta dati personali per tuo conto, in
            particolare i dati dei tuoi clienti e visitatori (&quot;<B>Dati del Cliente</B>&quot;). Fa parte dei{" "}
            <A href="/terms">Termini di Servizio</A> ed è efficace quando li accetti. In caso di contrasto con i
            Termini in materia di protezione dei dati, prevale questo DPA.
          </P>
        </>
      ),
    },
    {
      id: "details",
      title: "Dettagli del trattamento",
      body: (
        <Ul>
          <li>
            <B>Oggetto e durata:</B> fornitura delle funzioni di prenotazione, agente IA, messaggistica e pagina
            del Servizio, per tutto il tempo in cui le usi.
          </li>
          <li>
            <B>Natura e finalità:</B>
            <Ul>
              <li>raccolta e conservazione delle prenotazioni</li>
              <li>visualizzazione delle prenotazioni a te e al tuo personale</li>
              <li>invio di conferme e promemoria via email e, con il consenso del cliente, via WhatsApp</li>
              <li>risposte ai visitatori tramite il tuo agente IA</li>
              <li>hosting e assistenza</li>
            </Ul>
          </li>
          <li>
            <B>Interessati:</B> i tuoi clienti, potenziali clienti, visitatori e i membri del personale che
            aggiungi.
          </li>
          <li>
            <B>Categorie di dati:</B>
            <Ul>
              <li>nome, telefono, email</li>
              <li>indirizzo, se attivi il campo</li>
              <li>note</li>
              <li>dettagli dell&apos;appuntamento</li>
              <li>messaggi in chat</li>
              <li>nomi e orari del personale</li>
            </Ul>
          </li>
          <li>
            <B>Categorie particolari:</B> non previste. Non configurare il Servizio per raccoglierle, ad esempio
            dati sanitari nelle note di prenotazione, senza una base giuridica e una valutazione del rischio.
          </li>
        </Ul>
      ),
    },
    {
      id: "instructions",
      title: "Trattamento su istruzione documentata",
      body: (
        <P>
          Nandzz tratta i Dati del Cliente solo su tue istruzioni documentate. Le istruzioni sono i Termini, il
          presente DPA, e la configurazione e l&apos;uso che fai del Servizio. Fa eccezione il caso in cui il
          diritto dell&apos;UE o di uno Stato membro imponga diversamente: in tal caso ti informeremo, salvo che
          quella legge lo vieti. Ti avviseremo se riteniamo che un&apos;istruzione violi la normativa. Non
          vendiamo i Dati del Cliente, né li usiamo per fini nostri o per addestrare modelli di IA.
        </P>
      ),
    },
    {
      id: "confidentiality",
      title: "Riservatezza",
      body: (
        <P>
          Le persone autorizzate a trattare i Dati del Cliente sono vincolate alla riservatezza. L&apos;accesso
          è limitato a quanto serve per fornire il Servizio e l&apos;assistenza.
        </P>
      ),
    },
    {
      id: "security",
      title: "Misure di sicurezza",
      body: (
        <>
          <P>Adottiamo le misure tecniche e organizzative dell&apos;Allegato 1 (art. 32 GDPR).</P>
          <P>
            Possiamo aggiornarle, ma mai riducendo il livello complessivo di protezione.
          </P>
        </>
      ),
    },
    {
      id: "subprocessors",
      title: "Sub-responsabili",
      body: (
        <>
          <P>
            Ci concedi un&apos;autorizzazione generale a ricorrere a sub-responsabili. L&apos;elenco attuale è
            nell&apos;Allegato 2 e nell&apos;<A href="/privacy#sharing">Informativa privacy</A>. Ti comunicheremo
            ogni aggiunta o sostituzione con almeno <B>30 giorni</B> di anticipo, via email o in dashboard. Puoi
            opporti per ragionevoli motivi legati alla protezione dei dati. Se non troviamo una soluzione, puoi
            recedere dal servizio interessato con rimborso del periodo prepagato non goduto.
          </P>
          <P>
            Ogni sub-responsabile è vincolato a obblighi equivalenti a quelli di questo DPA. Restiamo responsabili
            del loro operato.
          </P>
        </>
      ),
    },
    {
      id: "assistance",
      title: "Assistenza al Titolare",
      body: (
        <>
          <P>
            Tenuto conto della natura del trattamento, ti assistiamo:
          </P>
          <Ul>
            <li>
              nel rispondere alle richieste degli interessati (artt. 15–22 GDPR). La dashboard ti permette di
              vedere, modificare, annullare e cancellare le prenotazioni. Se una richiesta arriva direttamente a
              noi, te la inoltriamo senza ritardo e non vi rispondiamo direttamente.
            </li>
            <li>
              in materia di sicurezza, notifica delle violazioni, valutazione d&apos;impatto e consultazione
              preventiva (artt. 32–36 GDPR)
            </li>
          </Ul>
        </>
      ),
    },
    {
      id: "breach",
      title: "Violazioni dei dati",
      body: (
        <P>
          Ti notificheremo senza ingiustificato ritardo, e comunque entro <B>48 ore</B> da quando ne veniamo a
          conoscenza, ogni violazione che riguardi i Dati del Cliente. La notifica conterrà le informazioni a
          nostra disposizione che ti servono per le tue notifiche ex artt. 33–34 GDPR, e la aggiorneremo man mano
          che ne sapremo di più.
        </P>
      ),
    },
    {
      id: "deletion",
      title: "Conservazione, restituzione e cancellazione",
      body: (
        <>
          <P>
            Puoi cancellare le prenotazioni in qualsiasi momento. Per impostazione predefinita, i dati del
            cliente nelle prenotazioni sono <B>anonimizzati dopo 24 mesi</B> dall&apos;appuntamento. Alla
            chiusura dell&apos;account cancelliamo i Dati del Cliente entro 30 giorni, e i backup vengono
            sovrascritti entro ulteriori 30 giorni. Fanno eccezione i dati che dobbiamo conservare per legge.
          </P>
          <P>
            Prima di chiudere l&apos;account puoi esportare i tuoi dati dalle Impostazioni.
          </P>
        </>
      ),
    },
    {
      id: "audits",
      title: "Informazioni e verifiche",
      body: (
        <P>
          Mettiamo a disposizione le informazioni necessarie a dimostrare il rispetto dell&apos;art. 28 GDPR,
          tra cui questo DPA, le misure di sicurezza e le certificazioni dei sub-responsabili. Se non bastano,
          consentiamo verifiche da parte tua o di un revisore indipendente vincolato alla riservatezza, con 30
          giorni di preavviso, a tue spese e non più di una volta l&apos;anno, salvo violazioni o richieste di
          un&apos;autorità.
        </P>
      ),
    },
    {
      id: "transfers",
      title: "Trasferimenti extra-UE",
      body: (
        <P>
          I Dati del Cliente sono conservati nell&apos;UE. Se un sub-responsabile li tratta fuori dall&apos;UE/SEE,
          garantiamo una tutela adeguata ai sensi del Capo V GDPR. Si tratta di una decisione di adeguatezza
          (incluso l&apos;EU–US Data Privacy Framework) o delle Clausole Contrattuali Standard (Modulo 3, da
          responsabile a responsabile), che abbiamo sottoscritto con il sub-responsabile interessato.
        </P>
      ),
    },
    {
      id: "controller-duties",
      title: "Le tue responsabilità",
      body: (
        <>
          <P>Sei responsabile:</P>
          <Ul>
            <li>della liceità del trattamento che disponi, compresa la base giuridica</li>
            <li>dell&apos;informativa ai tuoi clienti</li>
            <li>della raccolta del consenso ove necessario, ad esempio per i messaggi promozionali</li>
            <li>della correttezza dei dati che inserisci</li>
          </Ul>
        </>
      ),
    },
    {
      id: "liability",
      title: "Responsabilità e durata",
      body: (
        <P>
          La responsabilità ai sensi di questo DPA segue i Termini, fermo restando l&apos;art. 82 GDPR verso gli
          interessati. Il DPA dura finché trattiamo Dati del Cliente per tuo conto. Contatti:{" "}
          <Mail to={C.emails.privacy} />.
        </P>
      ),
    },
    {
      id: "annex-1",
      title: "Allegato 1: Misure tecniche e organizzative",
      body: (
        <Ul>
          <li>Cifratura in transito (TLS 1.2+) e a riposo di database, archivi e backup</li>
          <li>Sicurezza a livello di riga nel database: ogni attività accede solo ai propri record</li>
          <li>Chiavi di servizio conservate solo lato server</li>
          <li>Accessi del personale limitati allo stretto necessario, con autenticazione a più fattori sulle console di amministrazione e dei fornitori</li>
          <li>Password cifrate e supporto all&apos;accesso tramite OAuth</li>
          <li>Limiti di frequenza e rilevamento degli abusi sugli endpoint pubblici</li>
          <li>Visualizzazione dei contenuti web caricati dagli utenti in sandbox, isolata dall&apos;origine dell&apos;applicazione</li>
          <li>Backup automatici con ripristino temporale da parte del fornitore del database</li>
          <li>Minimizzazione: campi facoltativi disattivati per impostazione predefinita, statistiche con hash che cambia ogni giorno, cancellazioni automatiche a scadenza</li>
          <li>Procedura di gestione degli incidenti e registrazione delle azioni amministrative</li>
        </Ul>
      ),
    },
    {
      id: "annex-2",
      title: "Allegato 2: Sub-responsabili autorizzati",
      body: (
        <>
          <H3>Sub-responsabili che possono trattare i Dati del Cliente</H3>
          <SubprocessorTable locale="it" bookingOnly />
        </>
      ),
    },
  ],
};
